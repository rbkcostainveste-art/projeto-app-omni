-- Run inside BEGIN + migration + this test + ROLLBACK. Never persist synthetic events.
do $$
declare auth_id uuid;employee text;local_id uuid;local_employee text;local_base text;r jsonb;cycle timestamptz;task_id uuid;blocked boolean;
begin
 select d.auth_user_id,u.employee_number into auth_id,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active and coalesce(u.job_role,u.access_profile)='admin' limit 1;
 if auth_id is null then raise exception 'Admin test identity unavailable';end if;
 perform set_config('request.jwt.claim.sub',auth_id::text,true);
 insert into public.runway_handovers(id,prefix,model,base,date,opened_at,updated_at,created_by,checks)
 values('assistant-wash-rollback-test','ZZ-TST','S92','Assistant rollback only',current_date,now(),now(),employee,'{"compressorWash":"yes"}');
 if (select count(*) from public.runway_wash_events where handover_id='assistant-wash-rollback-test')<>1 then raise exception 'Capture failed';end if;
 select drying_task_id,drying_cycle_at into task_id,cycle from public.runway_wash_events where handover_id='assistant-wash-rollback-test';
 if task_id is null or cycle is null then raise exception 'Drying linkage failed';end if;
 update public.runway_handovers set checks=checks||'{"compressorWash":"yes"}' where id='assistant-wash-rollback-test';
 if (select count(*) from public.runway_wash_events where handover_id='assistant-wash-rollback-test')<>1 then raise exception 'Duplicate capture';end if;
 r:=public.assistant_wash_read(employee,null,null,'America/Sao_Paulo',null,'ZZ-TST','S92','open',0);
 if jsonb_array_length(r->'items')<>1 or (r->>'complete')::boolean then raise exception 'Pending or coverage incorrect';end if;
 -- A task ID reused for another cycle must not make the old wash pending again.
 update public.compressor_drying_tasks set triggered_at=cycle+interval '1 second' where id=task_id;
 r:=public.assistant_wash_read(employee,null,null,'America/Sao_Paulo',null,'ZZ-TST','S92','open',0);
 if jsonb_array_length(r->'items')<>0 then raise exception 'Cycle isolation failed';end if;
 blocked:=false;begin perform public.assistant_wash_read('not-this-employee');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Identity spoof accepted';end if;
 select d.auth_user_id,u.employee_number,u.assigned_base into local_id,local_employee,local_base from public.device_identities d join public.authorized_users u using(employee_number) where u.active and coalesce(u.job_role,u.access_profile)='mechanic' and nullif(u.assigned_base,'') is not null limit 1;
 if local_id is null then raise exception 'Mechanic test identity unavailable';end if;
 perform set_config('request.jwt.claim.sub',local_id::text,true);
 r:=public.assistant_wash_read(local_employee,null,null,'America/Sao_Paulo',null,'ZZ-TST');
 if jsonb_array_length(r->'items')<>0 then raise exception 'Cross-base data exposed';end if;
 blocked:=false;begin perform public.assistant_wash_read(local_employee,null,null,'America/Sao_Paulo','Assistant rollback only');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Cross-base override accepted';end if;
 blocked:=false;begin perform public.assistant_wash_read(local_employee,null,null,'America/Sao_Paulo',null,null,null,null,null);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Null filter accepted';end if;
 if has_function_privilege('anon','public.assistant_wash_read(text,date,date,text,text,text,text,text,integer)','execute') or has_table_privilege('authenticated','public.runway_wash_events','select') then raise exception 'Direct access exposed';end if;
end $$;
select 'wash capture, deduplication, cycle isolation, coverage, identity and base restrictions passed' as result;
