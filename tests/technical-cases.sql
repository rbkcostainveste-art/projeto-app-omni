begin;
do $test$
declare adm uuid; actor text; mech uuid; mech_employee text; r public.maintenance_records; n public.maintenance_records; c jsonb; cfg jsonb; ok boolean; audit_count int; rec jsonb; nid uuid; ac text; disposition jsonb;
begin
 select d.auth_user_id,d.employee_number into adm,actor from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id,d.employee_number into mech,mech_employee from public.device_identities d join public.authorized_users u using(employee_number) where not d.is_admin and u.active and u.job_role='mechanic' limit 1;
 if adm is null or mech is null then raise exception 'Test identities unavailable';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAT','not_logged','open','QA technical test','TC-QA',actor,'{"description":"Intermitência HSI","entries":[]}') returning * into r;
 if r.technical_case->>'official'<>'pending' or r.technical_case->>'report'<>'discrepancy' then raise exception 'Legacy fault incorrectly classified';end if;
 if exists(select 1 from public.technical_case_audit where event='migration' and old_value->>'priority'='not_logged' and new_value->>'official'='not_applicable') then raise exception 'Unsafe migration';end if;
 c:=r.technical_case||'{"investigation":"troubleshooting","reason":"Pesquisa técnica"}';
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));
 select * into r from public.maintenance_records where id=r.id;
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"aircraft":"released","reason":"Teste sem autorização"}'));exception when others then ok:=true;end;if not ok then raise exception 'Unauthorized release allowed';end if;
 cfg:=public.technical_case_action('config');
 c:=jsonb_build_object('permissions',jsonb_build_object('classify',jsonb_build_array(actor),'not_applicable',jsonb_build_array(actor),'aprs',jsonb_build_array(actor),'defer',jsonb_build_array(actor),'release',jsonb_build_array(actor),'close',jsonb_build_array(actor),'critical',jsonb_build_array(actor)),'cdlEnabled',false,'procedures','[]'::jsonb,'recipients',jsonb_build_array(actor));
 perform public.technical_case_action('configure',null,jsonb_build_object('revision',cfg->'revision','data',c,'reason','QA rollback'));
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"aircraft":"released","reason":"Sem disposição"}'));exception when others then ok:=true;end;if not ok then raise exception 'Release without disposition allowed';end if;
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"official":"not_applicable","notApplicableReason":"Teste","reason":"Teste"}'));exception when others then ok:=true;end;if not ok then raise exception 'Discrepancy marked not applicable';end if;
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"official":"linked","reason":"Sem número"}'));exception when others then ok:=true;end;if not ok then raise exception 'Official link without number';end if;
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"official":"linked","officialId":"QA-OPEN","aprsRef":"QA-APRS","investigation":"monitoring","reason":"Discrepância ainda ativa"}'));exception when others then ok:=true;end;if not ok then raise exception 'Monitoring with an active official discrepancy';end if;
 c:=r.technical_case||'{"official":"linked","officialId":"QA-EDB-1","officialClosed":true,"aprsRef":"QA-APRS-1","investigation":"monitoring","aircraft":"monitoring","reason":"APRS e encerramento conferidos"}';
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));
 select * into r from public.maintenance_records where id=r.id;
 if r.technical_case->>'aprsBy'<>actor or r.technical_case->>'aircraft'<>'monitoring' then raise exception 'Authorized APRS flow failed';end if;
 rec:=public.technical_case_action('recurrence',r.id,jsonb_build_object('revision',r.revision,'description','Sintoma repetiu'));
 select * into n from public.maintenance_records where id=(rec->>'id')::uuid;
 if n.technical_case->>'parentId'<>r.id::text or n.technical_case->>'official'<>'pending' then raise exception 'Recurrence link lost';end if;
 ok:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"reason":"Outra discrepância ativa"}'));exception when others then ok:=true;end;if not ok then raise exception 'Release ignored another active discrepancy';end if;
 ok:=false;begin delete from public.maintenance_records where id=n.id;exception when others then ok:=true;end;if not ok then raise exception 'Hard delete allowed';end if;
 -- Comments preserve the complete confirmed entry and are audited.
 update public.maintenance_records set data=data||jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id','qa-comment','kind','comment','description','Teste documentado','employeeNumber',actor,'at',now()))) where id=n.id;
 select count(*) into audit_count from public.technical_case_audit where record_id=n.id;
 if audit_count<2 then raise exception 'Comment audit missing';end if;
 ok:=false;begin update public.maintenance_records set data=jsonb_set(data,'{entries}','[]') where id=n.id;exception when others then ok:=true;end;if not ok then raise exception 'Confirmed comment silently removed';end if;
 -- Critical text is saved, and is not itself a reason to reject the report.
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAB','not_logged','open','QA critical test','TC-QA',actor,'{"description":"teste não realizado","entries":[]}') returning * into n;
 if not (n.technical_case->>'critical')::boolean then raise exception 'Critical signal absent';end if;
 if not exists(select 1 from public.technical_case_alerts where record_id=n.id and employee_number=actor) then raise exception 'Critical notification absent';end if;
 -- Reclassification has an explicit reason, authorized author and server timestamp/name.
 c:=n.technical_case||'{"report":"question","official":"not_applicable","notApplicableReason":"Revisão demonstrou consulta sem falha","reason":"Reclassificação formal"}';
 perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',c));
 select * into n from public.maintenance_records where id=n.id;
 if n.technical_case->>'notApplicableBy'<>actor or nullif(n.technical_case->>'notApplicableName','') is null or nullif(n.technical_case->>'notApplicableAt','') is null then raise exception 'Not applicable accountability missing';end if;
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||'{"investigation":"closed","reason":"Alerta crítico ainda ativo"}'));exception when others then ok:=true;end;if not ok then raise exception 'Closed an unresolved critical case';end if;
 -- MEL/CDL stay distinct; no default authorization, and reminders are generated before deadline.
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAM','not_logged','open','QA MEL test','TC-QA',actor,'{"description":"Componente ausente","entries":[]}') returning * into n;
 disposition:=jsonb_build_object('type','CDL','reference','CDL-1','conditions','Condições documentadas','deadline',now()+interval '12 hours','cdlItem','CDL-TEST','revision','1','performance','Limitação conferida');
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||jsonb_build_object('disposition',disposition,'reason','Teste CDL desabilitada')));exception when others then ok:=true;end;if not ok then raise exception 'Unconfigured CDL enabled';end if;
 disposition:=jsonb_build_object('type','MEL','reference','MEL-AUTH-1','conditions','Condições documentadas','deadline',now()+interval '12 hours');
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||jsonb_build_object('disposition',disposition,'reason','Teste MEL incompleta')));exception when others then ok:=true;end;if not ok then raise exception 'Incomplete MEL accepted';end if;
 disposition:=disposition||'{"melItem":"ITEM-QA","revision":"1","category":"Prazo específico","maintenanceProcedures":"Procedimento M conferido","operationalProcedures":"Procedimento O conferido","weather":"Condições conforme item selecionado"}';
 c:=n.technical_case||jsonb_build_object('official','linked','officialId','MEL-EDB-1','aircraft','deferred','disposition',disposition,'reason','Autorização formal conferida');
 perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',c));
 perform private.technical_deadline_alerts();
 if not exists(select 1 from public.technical_case_alerts where record_id=n.id and kind like 'deadline:%') then raise exception 'Deadline reminder absent';end if;
 select * into n from public.maintenance_records where id=n.id;
 disposition:=n.technical_case->'disposition'||jsonb_build_object('deadline',now()-interval '1 hour');
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||jsonb_build_object('disposition',disposition,'reason','Prazo vencido')));exception when others then ok:=true;end;if not ok then raise exception 'Expired authorization accepted';end if;
 -- A later failed test is saved and removes incompatible availability.
 update public.maintenance_records set data=data||jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id','qa-failed','kind','action','result','nonconforming','description','Resultado não satisfatório','employeeNumber',actor,'at',clock_timestamp()))) where id=n.id;
 select * into n from public.maintenance_records where id=n.id;
 if n.technical_case->>'aircraft'<>'unavailable' or n.technical_case->>'investigation'<>'test_failed' then raise exception 'Failed evidence not reflected';end if;
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||'{"investigation":"test_passed","aircraft":"deferred","reason":"Tentativa de reutilizar autorização anterior à falha"}'));exception when others then ok:=true;end;if not ok then raise exception 'Stale disposition reused after new adverse evidence';end if;
 -- New failed evidence requires renewed official closure and APRS confirmation.
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAX','not_logged','open','QA renewed APRS','TC-QA',actor,'{"description":"Conferência","entries":[]}') returning * into n;
 perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||'{"official":"linked","officialId":"QA-X","officialClosed":true,"aprsRef":"QA-X-APRS","aircraft":"released","investigation":"test_passed","reason":"Conferência inicial"}'));
 update public.maintenance_records set data=data||jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id','qa-new-failure','kind','action','result','nonconforming','description','Resultado adverso posterior','employeeNumber',actor,'at',clock_timestamp()))) where id=n.id;
 select * into n from public.maintenance_records where id=n.id;
 if (n.technical_case->>'officialClosed')::boolean or n.technical_case->>'aircraft'<>'unavailable' then raise exception 'New evidence retained previous closure';end if;
 ok:=false;begin perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||'{"officialClosed":true,"investigation":"test_passed","aircraft":"released","reason":"APRS anterior"}'));exception when others then ok:=true;end;if not ok then raise exception 'Stale APRS reused';end if;
 perform public.technical_case_action('update',n.id,jsonb_build_object('revision',n.revision,'case',n.technical_case||'{"officialClosed":true,"confirmAprs":true,"investigation":"test_passed","aircraft":"released","reason":"Nova conferência humana"}'));
 -- Private note conversion preserves author and the original version, while the note remains private.
 select x->>'prefix' into ac from public.shared_app_state s cross join lateral jsonb_array_elements(s.catalogs->'aircraft')x where s.id='main' limit 1;
 if ac is not null then
  nid:=gen_random_uuid();
  perform public.personal_note('save',jsonb_build_object('id',nid,'employee',actor,'title','QA note conversion','body','Observação original','prefix',ac,'attachments','[]'::jsonb,'revision',0));
  rec:=public.personal_note('convert',jsonb_build_object('id',nid,'employee',actor,'type','discrepancy','priority','routine','prefix',ac,'title','QA report','body','Relato revisado pelo autor','attachments','[]'::jsonb));
  if not exists(select 1 from public.technical_case_audit where record_id=(rec->>'id')::uuid and event='note_conversion' and old_value->>'author'=actor and old_value->>'body'='Observação original') then raise exception 'Note conversion provenance lost';end if;
  perform set_config('request.jwt.claim.sub',mech::text,true);
  ok:=false;begin perform public.personal_note('get',jsonb_build_object('id',nid,'employee',mech_employee));exception when others then ok:=true;end;if not ok then raise exception 'Private note exposed to another employee';end if;
 end if;
 perform set_config('request.jwt.claim.sub',mech::text,true);
 ok:=false;begin perform public.technical_case_action('configure',null,jsonb_build_object('revision',2,'data',c,'reason','Unauthorized'));exception when others then ok:=true;end;if not ok then raise exception 'Mechanic changed authorizations';end if;
 if private.technical_allowed('release') then raise exception 'Permission leaked';end if;
 perform set_config('request.jwt.claim.sub','',true);
 ok:=false;begin perform public.technical_case_action('config');exception when others then ok:=true;end;if not ok then raise exception 'Anonymous config allowed';end if;
end $test$;
rollback;
