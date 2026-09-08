begin;
do $$ declare a public.device_identities;b public.device_identities;req uuid:=gen_random_uuid();entry bigint;denied boolean;
begin
 select d.* into a from public.device_identities d join public.authorized_users u using(employee_number) where u.active limit 1;
 select d.* into b from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.employee_number<>a.employee_number limit 1;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 entry:=(public.personal_assistant('append',jsonb_build_object('employee',a.employee_number,'requestId',req,'message','QA private history','reply','QA answer'))->>'id')::bigint;
 perform public.personal_assistant('append',jsonb_build_object('employee',a.employee_number,'requestId',req,'message','QA private history','reply','QA answer'));
 if (select count(*) from public.personal_assistant_history where employee_number=a.employee_number and request_id=req)<>1 then raise exception 'Duplicate exchange';end if;
 if not exists(select 1 from jsonb_array_elements(public.personal_assistant('list',jsonb_build_object('employee',a.employee_number))) x where (x->>'id')::bigint=entry) then raise exception 'History not restored';end if;
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 if exists(select 1 from jsonb_array_elements(public.personal_assistant('list',jsonb_build_object('employee',b.employee_number))) x where (x->>'id')::bigint=entry) then raise exception 'History leaked';end if;
 denied:=false;begin perform public.personal_assistant('list',jsonb_build_object('employee',a.employee_number));exception when others then denied:=true;end;
 if not denied then raise exception 'Identity override allowed';end if;
 if has_table_privilege('authenticated','public.personal_assistant_history','select') or has_function_privilege('anon','public.personal_assistant(text,jsonb)','execute') then raise exception 'Access too broad';end if;
end $$;
rollback;
select 'PASS: one personal history, idempotent append, restore and identity isolation' result;
