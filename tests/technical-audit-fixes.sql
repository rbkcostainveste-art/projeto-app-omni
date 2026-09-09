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

 -- Critical comments in monitoring must persist and reset the local stage.
 update public.maintenance_records set data=data||jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id','audit-critical','kind','comment','description','teste não realizado','employeeNumber',actor,'at',clock_timestamp()))) where id=r.id;
 select * into r from public.maintenance_records where id=r.id;
 if r.technical_case->>'investigation'<>'triage' or r.technical_case->>'aircraft'<>'unavailable' or jsonb_array_length(r.data->'entries')<>1 then raise exception 'Critical comment lost';end if;
 if not exists(select 1 from public.technical_case_alerts where record_id=r.id) then raise exception 'Critical alert missing';end if;
 -- A routine reclassification cannot remove a previously included case from handover.
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage","priority":"routine","criticalReview":"Avaliação QA","reason":"Reclassificação QA","serviceEnteredAt":null}'));
 select * into r from public.maintenance_records where id=r.id;
 if nullif(r.technical_case->>'serviceEnteredAt','') is null then raise exception 'Handover membership removed';end if;
 -- Manual official verification captures actual session author, not an external sync.
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"officialId":"QA-OFFICIAL","confirmOfficial":true,"reason":"Conferência QA"}'));
 select * into r from public.maintenance_records where id=r.id;
 if r.technical_case->>'officialVerifiedBy'<>actor then raise exception 'Official verification author missing';end if;
 -- Configure a mechanic designation and validate active-mechanic restriction.
 cfg:=public.technical_case_action('config');
 ok:=false;begin perform public.technical_case_action('configure',null,jsonb_build_object('revision',cfg->'revision','data',(cfg->'data')||'{"aprsMechanics":["DOES-NOT-EXIST"]}','reason','QA'));exception when others then ok:=true;end;
 if not ok then raise exception 'Invalid APRS designation accepted';end if;
 perform public.technical_case_action('configure',null,jsonb_build_object('revision',cfg->'revision','data',(cfg->'data')||jsonb_build_object('aprsMechanics',jsonb_build_array(mech_employee)),'reason','QA designation'));
 perform set_config('request.jwt.claim.sub',mech::text,true);
 if not coalesce(private.technical_allowed('aprs'),false) then raise exception 'Designated mechanic APRS denied';end if;
 if not exists(select 1 from private.technical_recipients() where employee=mech_employee) then raise exception 'Designated mechanic missing from alerts';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 -- Structured counter tracking generates an alert at the measured limit.
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
 values(gen_random_uuid(),'fault',coalesce((select assigned_base from public.authorized_users where employee_number=mech_employee),'QA'),'S92','PR-QAW','routine','open','QA watch',actor,'{"technicalCase":true,"description":"Observação medida","entries":[]}',
 '{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"condition_watch","reason":"Avaliação QA","conditionWatch":{"reference":"QA-REF","measurement":"1","limit":"2","nextInspection":"100 horas","dueKind":"hours","dueValue":"100","currentValue":"100","counterSource":"Contador QA"}}') returning * into n;
 perform private.technical_deadline_alerts();
 if not exists(select 1 from public.technical_case_alerts where record_id=n.id and kind like 'watch:%' and employee_number=mech_employee) then raise exception 'Counter deadline alert missing';end if;
end $test$;
rollback;
select 'PASS: adverse evidence, persistent handover, official reference provenance, mechanic designation, counter alerts; all changes rolled back' result;

