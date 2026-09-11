-- Real RPC, transaction rollback: descriptive corrections for maintenance roles,
-- blocked foreign roles/base, preserved raw text/audit and concurrent-edit protection.
begin;
do $test$
declare adm uuid; mech uuid; employee text; base text; r public.maintenance_records; result jsonb; role_name text; blocked boolean; allowed_count int:=0; denied_count int:=0;
begin
 select d.auth_user_id into adm from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id,d.employee_number,coalesce(d.assigned_base,'QA') into mech,employee,base from public.device_identities d join public.authorized_users u using(employee_number) where not d.is_admin and u.active and u.job_role='mechanic' limit 1;
 if adm is null or mech is null then raise exception 'Test identities missing';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
 values(gen_random_uuid(),'fault',base,'S92','PR-QAT','not_logged','open','Raw QA text',employee,'{"description":"raw QA observation","entries":[],"technicalCase":true}',
 '{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage","originalObservation":{"title":"Raw QA text","description":"raw QA observation"}}') returning * into r;
 perform set_config('request.jwt.claim.sub',mech::text,true);
 foreach role_name in array array['mechanic','maintenance_assistant','maintenance_leader','maintenance_inspector','maintenance_coordinator','maintenance_manager','maintenance_director'] loop
  update public.authorized_users set job_role=role_name where employee_number=employee;
  result:=public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case||jsonb_build_object('reason','QA authorized assistant correction','document',jsonb_build_object('ata','34')),'title','QA corrected '||role_name,'description','QA corrected observation'));
  if result->>'title'<>'QA corrected '||role_name or result#>>'{data,description}'<>'QA corrected observation' then raise exception 'Correction lost for %',role_name;end if;
  select * into r from public.maintenance_records where id=r.id;
  if r.technical_case#>>'{originalObservation,description}'<>'raw QA observation' then raise exception 'Original overwritten';end if;
  if not exists(select 1 from public.technical_case_audit where record_id=r.id and actor_role=role_name and reason='QA authorized assistant correction' and new_value->>'title'='QA corrected '||role_name) then raise exception 'Missing audit for %',role_name;end if;
  allowed_count:=allowed_count+1;
 end loop;
 blocked:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision-1,'case',r.technical_case,'title','Stale write'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale correction accepted';end if;
 update public.device_identities set assigned_base='Other QA base' where auth_user_id=mech;
 blocked:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case,'title','Wrong base'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Foreign base accepted';end if;
 update public.device_identities set assigned_base=base where auth_user_id=mech;
 foreach role_name in array array['coordination','toolroom','commander','copilot','flight_attendant','dispatch'] loop
  update public.authorized_users set job_role=role_name where employee_number=employee;
  blocked:=false;begin perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case,'title','Unauthorized'));exception when others then blocked:=true;end;
  if not blocked then raise exception 'Unexpected correction access for %',role_name;end if;denied_count:=denied_count+1;
 end loop;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 result:=public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',r.technical_case,'title','QA admin correction'));
 if result->>'title'<>'QA admin correction' then raise exception 'Admin correction failed';end if;
 raise notice 'PASS: % maintenance roles + admin, % excluded roles, foreign base, stale revision and original/audit',allowed_count,denied_count;
end $test$;
rollback;
