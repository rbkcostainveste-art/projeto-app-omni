begin;
do $$
declare mech uuid;actor uuid; employee text; passage text:=gen_random_uuid()::text; task uuid; n integer;
begin
 select d.auth_user_id,d.employee_number into actor,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.access_profile='mechanic' and u.job_role='mechanic' limit 1;
 if actor is null then raise exception 'Maintenance test identity unavailable';end if;
 mech:=actor;perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 insert into public.runway_handovers(id,prefix,model,base,date,opened_at,updated_at,created_by,checks)
 values(passage,'TEST-WASH','S92','TEST',current_date,now(),now(),employee,'{"compressorWash":"pending"}');
 if exists(select 1 from public.compressor_drying_tasks where source_id=passage) then raise exception 'Enqueued before confirmation';end if;
 update public.runway_handovers set checks='{"compressorWash":"yes"}',actions=jsonb_build_object('compressorWash',jsonb_build_object('employeeNumber',employee,'at',now())) where id=passage;
 select id into task from public.compressor_drying_tasks where source_id=passage and status='pending' and prefix='TEST-WASH' and model='S92' and base='TEST' and triggered_by=employee;
 if task is null then raise exception 'Confirmed wash did not enqueue';end if;
 update public.runway_handovers set checks='{"compressorWash":"yes","hums":"yes"}' where id=passage;
 select count(*) into n from public.compressor_drying_tasks where source_id=passage;
 if n<>1 then raise exception 'Duplicate task';end if;
 execute 'reset role';
 select d.auth_user_id into actor from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role in ('commander','copilot') limit 1;
 if actor is null then raise exception 'Pilot test identity unavailable';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);execute 'set local role authenticated';
 if not exists(select 1 from public.compressor_drying_tasks where id=task) then raise exception 'Pilot cannot see task';end if;
 perform public.complete_compressor_drying(task);
 if exists(select 1 from public.compressor_drying_tasks where id=task and status='pending') then raise exception 'Completion did not clear queue';end if;
 execute 'reset role';
 if not exists(select 1 from public.runway_handovers where id=passage and checks->>'dryingRun'='yes' and actions#>>'{dryingRun,employeeNumber}'=(select employee_number from public.device_identities where auth_user_id=actor)) then raise exception 'Pilot completion did not sign runway';end if;
 perform set_config('request.jwt.claim.sub',mech::text,true);execute 'set local role authenticated';
 update public.runway_handovers set checks=jsonb_set(checks,'{compressorWash}','"no"') where id=passage;
 update public.runway_handovers set checks=jsonb_set(checks,'{compressorWash}','"yes"') where id=passage;
 if not exists(select 1 from public.runway_handovers where id=passage and checks->>'dryingRun'='pending' and not(actions?'dryingRun')) then raise exception 'New wash reused old drying signature';end if;
 if not exists(select 1 from public.compressor_drying_tasks where id=task and status='pending') then raise exception 'New wash did not reopen drying';end if;
 update public.runway_handovers set checks=jsonb_set(checks,'{dryingRun}','"yes"'),actions=jsonb_set(actions,'{dryingRun}',jsonb_build_object('employeeNumber',employee,'at',now())) where id=passage;
 if not exists(select 1 from public.compressor_drying_tasks where id=task and status='completed' and completed_by=employee) then raise exception 'Mechanic completion did not reach pilot queue';end if;
 update public.runway_handovers set checks=jsonb_set(checks,'{hums}','"yes"') where id=passage;
 if (select count(*) from public.compressor_drying_tasks where source_id=passage)<>1 then raise exception 'Sync created duplicate';end if;
 execute 'reset role';
end $$;
select 'PASS: authenticated maintenance wash creates one task, pilot and mechanic confirmations synchronize both ways; new wash resets the cycle' as result;
rollback;
