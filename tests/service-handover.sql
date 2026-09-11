begin;
do $test$
declare actor uuid; emp text; base_name text; prefix_name text; id1 uuid:=gen_random_uuid(); rev bigint; caught boolean;
begin
 select d.auth_user_id,d.employee_number,d.assigned_base into actor,emp,base_name from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='maintenance_coordinator' and d.assigned_base is not null limit 1;
 select a->>'prefix' into prefix_name from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') a where s.id='main' and a->>'base'=base_name limit 1;
 if actor is null or prefix_name is null then raise exception 'Missing fixtures';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data) values(id1,'inspection',base_name,'S92',prefix_name,'routine','open','QA handover',emp,'{"planningState":"completed","entries":[]}');
 select revision into rev from public.maintenance_records where id=id1;
 execute 'set local role authenticated';
 perform public.service_handover_read(jsonb_build_array(jsonb_build_object('id',id1,'revision',rev)));
 if not exists(select 1 from public.service_handover_read('[]') receipt where receipt.record_id=id1 and receipt.revision=rev) then raise exception 'Receipt not saved';end if;
 caught:=false;begin perform public.service_handover_read(jsonb_build_array(jsonb_build_object('id',id1,'revision',rev-1)));exception when others then caught:=sqlerrm like '%mudou%';end;
 if not caught then raise exception 'Stale version accepted';end if;
 execute 'reset role';
 if not exists(select 1 from public.maintenance_records where id=id1 and revision=rev and status='open') then raise exception 'Acknowledgment changed technical state';end if;
 update public.maintenance_records set revision=revision+1 where id=id1;
 if not exists(select 1 from public.service_handover_reads where record_id=id1 and employee_number=emp and revision=rev) then raise exception 'Receipt advanced without acknowledgment';end if;
 if exists(select 1 from public.service_handover_reads where record_id=id1 and employee_number<>emp) then raise exception 'Another person marked read';end if;
 perform set_config('request.jwt.claim.sub','',true);
 caught:=false;begin perform public.service_handover_read('[]');exception when others then caught:=true;end;
 if not caught then raise exception 'Unauthenticated access';end if;
end $test$;
rollback;
