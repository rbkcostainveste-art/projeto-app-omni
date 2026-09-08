begin;
do $$ declare actor uuid; otherperson text; cid uuid:=gen_random_uuid();cid2 uuid:=gen_random_uuid();begin
 select d.auth_user_id into actor from public.device_identities d join public.authorized_users u using(employee_number) where u.active limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select employee_number into otherperson from public.authorized_users where active and employee_number<>(select employee_number from public.device_identities where auth_user_id=actor) limit 1;
 perform public.internal_chat('create',jsonb_build_object('id',cid,'members',jsonb_build_array(otherperson),'title','QA sem aeronave','aircraftPrefix',''));
 perform public.internal_chat('create',jsonb_build_object('id',cid2,'members',jsonb_build_array(otherperson),'title','QA CHT','aircraftPrefix','PR-CHT'));
 if not exists(select 1 from public.internal_conversations where id=cid and aircraft_prefix is null) then raise exception 'Empty aircraft failed';end if;
 if not exists(select 1 from public.internal_conversations where id=cid2 and aircraft_prefix='PR-CHT') then raise exception 'CHT failed';end if;
end $$;
rollback;
select 'PASS: creates without aircraft and with PR-CHT from actual catalog' result;
