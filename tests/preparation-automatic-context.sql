-- Applicable check counts, previous-flight binding, and maintenance-flight gate.
-- All fixtures and identity changes are rolled back.
begin;
do $$
declare adm uuid;mech uuid;pilot uuid;employee text;pilot_employee text;
 first_id text:=gen_random_uuid()::text;next_id text:=gen_random_uuid()::text;maint_id text:=gen_random_uuid()::text;
 prefix text:='QA-'||substr(gen_random_uuid()::text,1,8);f jsonb;v jsonb;k text;denied boolean;
begin
 select d.auth_user_id into adm from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id,d.employee_number into mech,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='mechanic' and u.active limit 1;
 select d.auth_user_id,d.employee_number into pilot,pilot_employee from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='commander' and u.active limit 1;
 if adm is null or mech is null or pilot is null then raise exception 'Required QA identities unavailable';end if;
 update public.authorized_users set assigned_base='QA-auto' where employee_number=employee;
 update public.device_identities set assigned_base='QA-auto' where employee_number=employee;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 f:=jsonb_build_object('id',first_id,'prefix',prefix,'model','S92','base','QA-auto','date',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'departure','09:00','commander',pilot_employee,'planningStatus','confirmed','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown','pending','revision',1,'acknowledged','{}'::jsonb);
 perform public.mutate_shared_item('flights',first_id,f,'create');
 perform public.mutate_shared_item('flights',next_id,f||jsonb_build_object('id',next_id,'departure','11:00'),'create');
 perform public.mutate_shared_item('flights',maint_id,f||jsonb_build_object('id',maint_id,'prefix',prefix||'M','maintenancePostId','qa-maintenance'),'create');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',mech::text,true);
 v:=public.get_flight_operation(first_id);
 foreach k in array array['drain','fuel','inspection','hums'] loop
  v:=public.record_flight_operation(first_id,gen_random_uuid(),(v->>'revision')::int,'approve',jsonb_build_object('key',k,'result','ok'));
 end loop;
 if v#>>'{preparation,status}'<>'ready' or v#>>'{preparation,checklist,total}'<>'4' then raise exception 'First flight automatic readiness failed';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform public.mutate_shared_item('flights',first_id,'{"shutdown":"ok","actualShutdown":"10:00"}','update');
 v:=public.get_flight_operation(first_id);
 if v#>>'{preparation,status}'<>'inactive' then raise exception 'Finished flight kept active preparation';end if;
 perform set_config('request.jwt.claim.sub',mech::text,true);
 v:=public.get_flight_operation(next_id);
 foreach k in array array['fuel','inspection','hums'] loop
  v:=public.record_flight_operation(next_id,gen_random_uuid(),(v->>'revision')::int,'approve',jsonb_build_object('key',k,'result','ok'));
 end loop;
 if v#>>'{preparation,status}'<>'ready' or v#>>'{preparation,checklist,total}'<>'3' or v#>>'{checks,inspection,targetFlightId}'<>first_id then raise exception 'Between-flight readiness/binding failed';end if;
 v:=public.get_flight_operation(maint_id);
 foreach k in array array['fuel','inspection'] loop
  v:=public.record_flight_operation(maint_id,gen_random_uuid(),(v->>'revision')::int,'approve',jsonb_build_object('key',k,'result','ok'));
 end loop;
 if v#>>'{preparation,status}'<>'ready' or v#>>'{preparation,checklist,total}'<>'2' then raise exception 'Maintenance flight readiness failed';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform public.mutate_shared_item('flights',maint_id,'{"fuelAmount":"100","fuelUnit":"L"}','update');
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 v:=public.get_flight_operation(maint_id);
 denied:=false;begin perform public.record_flight_operation(maint_id,gen_random_uuid(),(v->>'revision')::int,'event',jsonb_build_object('type','engine1_on','at',now()));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Maintenance event bypassed invalidated fuel approval';end if;
 perform set_config('request.jwt.claim.sub',mech::text,true);
 v:=public.record_flight_operation(maint_id,gen_random_uuid(),(v->>'revision')::int,'approve','{"key":"fuel","result":"ok"}');
 if v#>>'{preparation,status}'<>'ready' then raise exception 'Maintenance fuel recheck failed';end if;
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 v:=public.record_flight_operation(maint_id,gen_random_uuid(),(v->>'revision')::int,'event',jsonb_build_object('type','engine1_on','at',now()));
 if v#>>'{preparation,status}'<>'inactive' then raise exception 'Started operation retained preparation badge';end if;
 execute 'reset role';
end $$;
rollback;
