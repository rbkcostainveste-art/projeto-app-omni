begin;
do $test$
declare actor uuid; pilot uuid; employee text; other_employee text; target text; b text; role_name text; caught boolean; prefix text; catalog jsonb;
begin
 select d.auth_user_id,d.assigned_base into actor,b from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='coordination' and d.assigned_base is not null limit 1;
 select d.auth_user_id,d.employee_number into pilot,target from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='commander' limit 1;
 select employee_number into other_employee from public.authorized_users where active and job_role='mechanic' limit 1;
 if actor is null or pilot is null or b is null then raise exception 'Missing fixtures';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 foreach role_name in array array['commander','copilot','flight_attendant'] loop
  update public.authorized_users set job_role=role_name where employee_number=target;
  execute 'set local role authenticated';
  perform public.update_user_operational_assignment(target,b,array['S92','AW139'],'mission_1','day');
  execute 'reset role';
  if not exists(select 1 from public.authorized_users where employee_number=target and assigned_base=b) or not exists(select 1 from public.device_identities where employee_number=target and assigned_base=b) then raise exception 'Crew base not persisted: %',role_name;end if;
 end loop;
 execute 'set local role authenticated';
 caught:=false;begin perform public.update_user_operational_assignment(other_employee,b,'{}','','');exception when others then caught:=sqlerrm like '%somente a tripulação%';end;
 if not caught then raise exception 'Coordination modified noncrew';end if;
 execute 'reset role';
 update public.authorized_users set job_role='commander' where employee_number=target;
 select a->>'prefix' into prefix from public.shared_app_state s cross join lateral jsonb_array_elements(s.catalogs->'aircraft') a where s.id='main' limit 1;
 execute 'set local role authenticated';
 catalog:=public.update_aircraft_management(prefix,b,null,null);
 if not exists(select 1 from jsonb_array_elements(catalog->'aircraft') a where a->>'prefix'=prefix and a->>'base'=b) then raise exception 'Aircraft base update failed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if private.current_crew_base() is distinct from b or private.current_crew_drying_base() is distinct from b then raise exception 'Configured base ignored';end if;
 execute 'set local role authenticated';
 caught:=false;begin perform public.update_user_operational_assignment(target,'Other','{}','','');exception when others then caught:=sqlerrm like '%Sem permissão%';end;
 if not caught then raise exception 'Pilot self reassignment allowed';end if;
 execute 'reset role';
end $test$;
select 'PASS coordination crew-only management; all crew roles; identity persistence; configured base priority; unauthorized update blocked' result;
rollback;
