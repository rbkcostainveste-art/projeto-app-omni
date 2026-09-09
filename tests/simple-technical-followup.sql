begin;
do $$
declare a uuid; emp text; mech uuid; me text; mb text; r public.maintenance_records; cfg jsonb; c jsonb; w jsonb; failed boolean; post_id text;
begin
 select d.auth_user_id,d.employee_number into a,emp from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id,d.employee_number,d.assigned_base into mech,me,mb from public.device_identities d join public.authorized_users u using(employee_number) where not d.is_admin and u.active and u.job_role='mechanic' limit 1;
 if a is null or mech is null then raise exception 'Missing test identities';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 cfg:=public.technical_case_action('config');
 c:=cfg->'data';c:=jsonb_set(c,'{permissions}',coalesce(c->'permissions','{}')||jsonb_build_object('classify',jsonb_build_array(emp)));
 perform public.technical_case_action('configure',null,jsonb_build_object('revision',cfg->'revision','data',c,'reason','QA rollback'));
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
 values(gen_random_uuid(),'fault',mb,'S92','PR-QAF','not_logged','open','QA follow-up',emp,'{"technicalCase":true,"description":"Condição observada","entries":[]}', '{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage","priority":"routine"}') returning * into r;
 if (select count(*) from public.operational_wall_posts where data->>'maintenanceRecordId'=r.id::text)<>1 then raise exception 'Routine case mirror absent';end if;
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"priority":"urgent","reason":"Atenção prioritária"}'));
 select * into r from public.maintenance_records where id=r.id;
 select data into w from public.operational_wall_posts where data->>'maintenanceRecordId'=r.id::text;
 if w->>'priority'<>'urgent' or w#>>'{technicalCase,priority}'<>'urgent' then raise exception 'Urgency not synchronized';end if;
 if not exists(select 1 from jsonb_array_elements(w->'history') e where e->>'event'='Atualizou prioridade do relato técnico') then raise exception 'Priority change absent from timeline';end if;
 if (select count(*) from public.operational_wall_posts where data->>'maintenanceRecordId'=r.id::text)<>1 then raise exception 'Duplicate wall post';end if;
 failed:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"investigation":"condition_watch","reason":"Sem dados"}'));exception when others then failed:=true;end;if not failed then raise exception 'Missing limits accepted';end if;
 c:=r.technical_case||'{"investigation":"condition_watch","reason":"Avaliação documentada","conditionWatch":{"reference":"Documento QA revisão 1","measurement":"Medição QA","limit":"Limite QA","nextInspection":"Antes da próxima operação"}}';
 perform set_config('request.jwt.claim.sub',mech::text,true);
 failed:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));exception when others then failed:=true;end;if not failed then raise exception 'Unqualified confirmation allowed';end if;
 post_id:=public.create_maintenance_request(r.id,'Giro em baixa','QA ação pendente',array[me],'','{}');
 if not exists(select 1 from public.operational_wall_posts where id=post_id and data#>>'{actions,0,status}'='pending' and data->>'maintenanceRecordId'=r.id::text) then raise exception 'Mechanic action not linked or not pending';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select * into r from public.maintenance_records where id=r.id;
 perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));
 select * into r from public.maintenance_records where id=r.id;
 if r.technical_case->>'conditionBy'<>emp or r.technical_case->>'official'<>'evaluation' or r.technical_case->>'aircraft'<>'evaluation' then raise exception 'Condition confirmation changed official/release state';end if;
 failed:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||'{"report":"discrepancy","reason":"Ativa"}'));exception when others then failed:=true;end;if not failed then raise exception 'Active discrepancy accepted as within limits';end if;
 update public.maintenance_records set data=jsonb_set(data,'{entries}',data->'entries'||jsonb_build_array(jsonb_build_object('id','qa-adverse','kind','action','result','nonconforming','description','Medição fora do limite','employeeNumber',emp,'at',clock_timestamp()))) where id=r.id;
 select * into r from public.maintenance_records where id=r.id;
 if r.technical_case->>'investigation'<>'test_failed' or r.technical_case->>'aircraft'<>'unavailable' then raise exception 'Adverse evidence not preserved';end if;
 if not exists(select 1 from public.technical_case_audit where record_id=r.id and new_value::text like '%condition_watch%') then raise exception 'Condition audit missing';end if;
end $$;
rollback;
