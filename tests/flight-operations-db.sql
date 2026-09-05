-- Integration checks are rolled back, including every fixture and identity change.
begin;
do $$
declare admin_id uuid;pilot_id uuid;mech_id uuid;aux_id uuid;pilot_employee text;f jsonb;v jsonb;request uuid;fid text:=gen_random_uuid()::text;fid2 text:=gen_random_uuid()::text;prefix text:='TEST-'||substr(gen_random_uuid()::text,1,8);ts timestamptz:=now()-interval '3 minutes';n integer:=0;t text;denied boolean;day text:=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD');
begin
 select d.auth_user_id into admin_id from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='admin' limit 1;
 select d.auth_user_id,u.employee_number into pilot_id,pilot_employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='commander' limit 1;
 select d.auth_user_id into mech_id from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='mechanic' limit 1;
 select d.auth_user_id into aux_id from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='maintenance_assistant' limit 1;
 if admin_id is null or pilot_id is null or mech_id is null or aux_id is null then raise exception 'Fixture identities unavailable'; end if;
 update public.authorized_users set assigned_base=null where employee_number in (select employee_number from public.device_identities where auth_user_id in (mech_id,aux_id));
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 f:=jsonb_build_object('id',fid,'prefix',prefix,'model','S92','base','TEST','date',day,'departure','09:00','planningStatus','confirmed','commander',pilot_employee,'fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown','pending','revision',1,'acknowledged','{}'::jsonb);
 perform public.mutate_shared_item('flights',fid,f,'create');perform public.mutate_shared_item('flights',fid2,f||jsonb_build_object('id',fid2,'departure','12:00'),'create');
 perform set_config('request.jwt.claim.sub',aux_id::text,true);
 v:=public.get_flight_operation(fid);if not (v->>'first')::boolean or not (v->>'canExecute')::boolean or (v->>'canSign')::boolean then raise exception 'Auxiliary permissions incorrect'; end if;
 request:=gen_random_uuid();v:=public.record_flight_operation(fid,request,0,'execute','{"key":"drain"}');
 if v#>'{checks,drain,execution}' is null or v#>'{checks,drain,approval}' is not null then raise exception 'Execution incorrectly signed'; end if;
 v:=public.record_flight_operation(fid,request,0,'execute','{"key":"drain"}');if (v->>'revision')::int<>1 then raise exception 'Duplicate request replayed'; end if;
 denied:=false;begin perform public.record_flight_operation(fid,gen_random_uuid(),1,'approve','{"key":"drain","result":"ok"}');exception when others then denied:=true;end;if not denied then raise exception 'Auxiliary signed';end if;
 denied:=false;begin perform public.record_flight_operation(fid,gen_random_uuid(),1,'execute','{"key":"fuel"}');exception when others then denied:=true;end;if not denied then raise exception 'Auxiliary executed fuel check';end if;
 denied:=false;begin perform public.mutate_shared_item('flights',fid,'{"preflight":"ok"}','update');exception when others then denied:=true;end;if not denied then raise exception 'Legacy auxiliary bypass';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),1,'execute','{"key":"hums"}');
 perform set_config('request.jwt.claim.sub',mech_id::text,true);
 v:=public.record_flight_operation(fid,gen_random_uuid(),2,'approve','{"key":"drain","result":"ok"}');if v#>'{checks,drain,execution}' is null or v#>'{checks,drain,approval}' is null then raise exception 'Executor or signer lost';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),3,'approve','{"key":"hums","result":"ok"}');
 perform set_config('request.jwt.claim.sub',pilot_id::text,true);
 denied:=false;begin perform public.record_flight_operation(fid,gen_random_uuid(),4,'approve','{"key":"fuel","result":"ok"}');exception when others then denied:=true;end;if not denied then raise exception 'Pilot signed maintenance';end if;
 foreach t in array array['apu_on','engine1_on','engine2_on','apu_off','takeoff','landing','engine1_off','engine2_off','apu_on','apu_off','rotor_brake','finish'] loop
  v:=public.record_flight_operation(fid,gen_random_uuid(),4+n,'event',jsonb_build_object('type',t,'at',ts+n*interval '1 second'));n:=n+1;
  if n=1 then
   perform set_config('request.jwt.claim.sub',mech_id::text,true);
   denied:=false;begin perform public.record_flight_operation(fid2,gen_random_uuid(),0,'approve','{"key":"inspection","result":"ok"}');exception when others then denied:=true;end;if not denied then raise exception 'Between-flight signed before previous operation ended';end if;
   perform set_config('request.jwt.claim.sub',pilot_id::text,true);
  end if;
 end loop;
 if jsonb_array_length(v->'events')<>12 or not (v->>'closed')::boolean then raise exception 'Event sequence not preserved';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),16,'correct',jsonb_build_object('id',v#>>'{events,2,id}','at',ts+interval '2.5 seconds'));
 if jsonb_array_length(v#>'{events,2,corrections}')<>1 then raise exception 'Correction audit missing';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),17,'delete_event',jsonb_build_object('id',v#>>'{events,10,id}'));
 if jsonb_array_length(v->'events')<>11 or exists(select 1 from jsonb_array_elements(v->'events') where value->>'type'='rotor_brake') then raise exception 'Independent event not removed';end if;
 if not exists(select 1 from public.flight_operation_records r,jsonb_array_elements(r.audit) a where r.flight_id=fid and a->>'action'='delete_event' and a#>>'{payload,removedEvent,type}'='rotor_brake') then raise exception 'Deletion audit missing';end if;
 denied:=false;begin perform public.record_flight_operation(fid,gen_random_uuid(),18,'delete_event',jsonb_build_object('id',v#>>'{events,4,id}'));exception when others then denied:=true;end;if not denied then raise exception 'Dependent event deletion allowed';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),18,'delete_event',jsonb_build_object('id',v#>>'{events,10,id}'));
 if (v->>'closed')::boolean then raise exception 'Removing finish did not reopen operation';end if;
 if exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) x where s.id='main' and x->>'id'=fid and (x->>'shutdown'='ok' or nullif(x->>'actualShutdown','') is not null)) then raise exception 'Stale shutdown after removal';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),19,'event',jsonb_build_object('type','finish','at',now()));
 perform private.validate_operation_events('[{"type":"apu_on","at":"2026-09-04T23:55:00-03:00"},{"type":"apu_off","at":"2026-09-05T00:05:00-03:00"},{"type":"finish","at":"2026-09-05T00:06:00-03:00"}]','S92');
 v:=public.get_flight_operation(fid2);if (v->>'first')::boolean or v->>'previousFlightId'<>fid then raise exception 'Next operation not linked to previous';end if;
 perform set_config('request.jwt.claim.sub',mech_id::text,true);
 denied:=false;begin perform public.record_flight_operation(fid2,gen_random_uuid(),0,'approve','{"key":"drain","result":"ok"}');exception when others then denied:=true;end;if not denied then raise exception 'Drain allowed on second operation';end if;
 v:=public.record_flight_operation(fid2,gen_random_uuid(),0,'approve','{"key":"inspection","result":"ok"}');if v#>>'{checks,inspection,targetFlightId}'<>fid or v#>>'{checks,inspection,kind}'<>'between' then raise exception 'Between flight target incorrect';end if;
 denied:=false;begin perform public.record_flight_operation(fid,gen_random_uuid(),20,'delete_event',jsonb_build_object('id',v#>>'{events,0,id}'));exception when others then denied:=sqlerrm like '%Somente piloto escalado%';end;if not denied then raise exception 'Mechanic deletion not denied by role';end if;
 v:=public.record_flight_operation(fid,gen_random_uuid(),20,'approve','{"key":"postflight","result":"ok"}');if v#>>'{checks,postflight,targetFlightId}'<>fid then raise exception 'Postflight without next flight incorrect';end if;
 perform set_config('request.jwt.claim.sub',pilot_id::text,true);v:=public.get_flight_operation(fid2);
 foreach t in array array['engine1_on','engine2_on','takeoff'] loop
  v:=public.record_flight_operation(fid2,gen_random_uuid(),(v->>'revision')::int,'event',jsonb_build_object('type',t,'at',now()));
 end loop;
 v:=public.record_flight_operation(fid2,gen_random_uuid(),(v->>'revision')::int,'delete_event',jsonb_build_object('id',v#>>'{events,2,id}'));
 if exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) x where s.id='main' and x->>'id'=fid2 and (x->>'engineStart'='ok' or nullif(x->>'actualEngineStart','') is not null)) then raise exception 'Stale departure after removal';end if;
 while jsonb_array_length(v->'events')>0 loop
  v:=public.record_flight_operation(fid2,gen_random_uuid(),(v->>'revision')::int,'delete_event',jsonb_build_object('id',v->'events'->-1->>'id'));
 end loop;
 if exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) x where s.id='main' and x->>'id'=fid2 and nullif(x->>'operationStartedAt','') is not null) then raise exception 'Stale start after removing all events';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.mutate_shared_item('flights',fid2,'{"commander":"not-assigned"}','update');
 perform set_config('request.jwt.claim.sub',pilot_id::text,true);denied:=false;begin perform public.get_flight_operation(fid2);exception when others then denied:=true;end;if not denied then raise exception 'Pilot saw unassigned operation';end if;
 if has_table_privilege('authenticated','public.flight_operation_records','INSERT') or has_table_privilege('authenticated','public.flight_operation_records','UPDATE') or has_table_privilege('anon','public.flight_operation_records','SELECT') then raise exception 'Direct access to operation records';end if;
end $$;
select 'PASS: execution, approval, role isolation, idempotency, event sequence, first/next operation, previous-flight linkage and postflight' as result;
rollback;
