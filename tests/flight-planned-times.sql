begin;
do $$
declare d public.device_identities; f jsonb; result jsonb; role_name text; caught boolean; rev bigint:=1;
begin
 select x.* into d from public.device_identities x join public.authorized_users u using(employee_number) where u.active and u.job_role='commander' limit 1;
 if d.auth_user_id is null then raise exception 'Missing pilot fixture';end if;
 perform set_config('request.jwt.claim.sub',d.auth_user_id::text,true);
 update public.device_identities set signature_verified_at=now(),assigned_base='QA',is_admin=false,access_profile='pilot' where auth_user_id=d.auth_user_id;
 f:=jsonb_build_object('id','qa-planned-times','prefix','PR-QAT','base','QA','date','2026-09-11','departure','12:00','duration',1,'revision',1,'commander',d.employee_number,'copilot',d.employee_number,'planningStatus','confirmed','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown','pending','history','[]'::jsonb);
 update public.shared_app_state set flights=flights||jsonb_build_array(f) where id='main';
 foreach role_name in array array['commander','copilot'] loop
  update public.authorized_users set job_role=role_name,assigned_base='QA',access_profile=case when role_name='coordination' then 'coordination' else 'pilot' end where employee_number=d.employee_number;
  update public.authorized_users set assigned_base='QA' where employee_number=d.employee_number;
  execute 'set local role authenticated';
  begin result:=public.update_flight_planned_times('qa-planned-times',rev,'13:00',1+rev::numeric/10);exception when others then raise exception 'role % employee % base % flightbase % failed: %',role_name,d.employee_number,(select assigned_base from public.device_identities where auth_user_id=d.auth_user_id),(select value->>'base' from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'='qa-planned-times'),sqlerrm;end;
  execute 'reset role';
  if result->>'departure'<>'13:00' or result->>'updatedBy'<>d.employee_number or result->>'engineStart'<>'pending' then raise exception 'Update failed';end if;
  rev:=(result->>'revision')::bigint;
 end loop;
 select x.* into d from public.device_identities x join public.authorized_users u using(employee_number) where u.active and u.job_role='coordination' and x.assigned_base is not null limit 1;
 if d.auth_user_id is null then raise exception 'Missing coordination fixture';end if;
 perform set_config('request.jwt.claim.sub',d.auth_user_id::text,true);
 update public.device_identities set signature_verified_at=now() where auth_user_id=d.auth_user_id;
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'='qa-planned-times' then jsonb_set(value,'{base}',to_jsonb(d.assigned_base)) else value end) from jsonb_array_elements(flights)) where id='main';
 execute 'set local role authenticated';
 result:=public.update_flight_planned_times('qa-planned-times',rev,'14:00',2);
 execute 'reset role';
 rev:=(result->>'revision')::bigint;
 caught:=false;begin perform public.update_flight_planned_times('qa-planned-times',rev-1,'14:00',2);exception when others then caught:=sqlerrm like '%atualizado%';end;if not caught then raise exception 'Stale revision allowed';end if;
 caught:=false;begin perform public.update_flight_planned_times('qa-planned-times',rev,'99:00',2);exception when others then caught:=sqlerrm like '%inválidos%';end;if not caught then raise exception 'Invalid time allowed';end if;
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'='qa-planned-times' then jsonb_set(value,'{base}','"OTHER"') else value end) from jsonb_array_elements(flights)) where id='main';
 caught:=false;begin perform public.update_flight_planned_times('qa-planned-times',rev,'14:00',2);exception when others then caught:=sqlerrm like '%tripulação escalada%';end;if not caught then raise exception 'Wrong base allowed';end if;
 if jsonb_array_length(result->'history')<3 then raise exception 'Missing authorship';end if;
end $$;
select 'PASS commander, copilot, coordination, unauthorized base, stale revision, invalid time, authorship, actual operation unchanged' result;
rollback;
