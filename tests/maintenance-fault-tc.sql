begin;
do $$
declare actor uuid; emp text; r public.maintenance_records; failed boolean;
begin
 select d.auth_user_id,d.employee_number into actor,emp from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 if actor is null then raise exception 'Missing test identity';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 failed:=false;begin
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data,technical_case)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAT','not_logged','open','QA sem TC','   ',emp,'{"technicalCase":true,"description":"QA","entries":[]}','{"report":"discrepancy","official":"linked","officialId":"EDB-QA","aircraft":"evaluation","investigation":"triage"}');
 exception when others then if sqlerrm not like '%número da TC%' then raise;end if;failed:=true;end;
 if not failed then raise exception 'Pane accepted without TC despite eDB ID';end if;
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data,technical_case)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAT','not_logged','open','QA com TC','  TC-123  ',emp,'{"technicalCase":true,"description":"QA","entries":[]}','{"report":"discrepancy","official":"linked","officialId":"EDB-QA","aircraft":"evaluation","investigation":"triage"}') returning * into r;
 if r.tc<>'TC-123' or r.technical_case->>'officialId'<>'EDB-QA' then raise exception 'TC and eDB reference mixed';end if;
 failed:=false;begin update public.maintenance_records set tc='' where id=r.id;exception when others then if sqlerrm not like '%número da TC%' then raise;end if;failed:=true;end;
 if not failed then raise exception 'Confirmed pane TC erased';end if;
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAT','not_logged','open','QA relato livre',emp,'{"technicalCase":true,"description":"QA","entries":[]}','{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage"}');
end $$;
rollback;
