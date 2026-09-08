begin;
do $test$
declare adm uuid;pilot uuid;mechanic uuid;employee text;path text:='00000000-0000-4000-8000-000000008888/test.pdf';
begin
 select d.auth_user_id into adm from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id,d.employee_number into pilot,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='commander' and u.active limit 1;
 select d.auth_user_id into mechanic from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='mechanic' and u.active limit 1;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set flights=flights||jsonb_build_array(jsonb_build_object('id',split_part(path,'/',1),'date','2026-09-08')) where id='main';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if public.cockpit_document_access(path) then raise exception 'Unassigned pilot can read';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set flights=(select jsonb_agg(case when f->>'id'=split_part(path,'/',1) then f||jsonb_build_object('commander',employee) else f end) from jsonb_array_elements(flights) f) where id='main';
 if not public.cockpit_document_access(path,true) then raise exception 'Admin cannot upload';end if;
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if not public.cockpit_document_access(path) then raise exception 'Newly assigned pilot cannot read';end if;
 if public.cockpit_document_access(path,true) then raise exception 'Pilot can upload through coordination-only path';end if;
 perform set_config('request.jwt.claim.sub',mechanic::text,true);
 if public.cockpit_document_access(path) then raise exception 'Mechanic can see documentation';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set flights=(select jsonb_agg(case when f->>'id'=split_part(path,'/',1) then f-'commander' else f end) from jsonb_array_elements(flights) f) where id='main';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if public.cockpit_document_access(path) then raise exception 'Removed crew retained new download access';end if;
end $test$;
rollback;
