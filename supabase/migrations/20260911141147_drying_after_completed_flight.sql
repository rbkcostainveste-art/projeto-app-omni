create or replace function private.current_crew_drying_base() returns text
language sql stable security definer set search_path='' as $$
 with actor as (
 select u.employee_number from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=auth.uid() and u.active and u.job_role in('commander','copilot','flight_attendant')
 ), today as (
 select f,coalesce(nullif(f->>'operationStartedAt',''),nullif(f->>'actualEngineStart','')) started
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f cross join actor a
 where s.id='main' and a.employee_number in(f->>'commander',f->>'copilot',f->>'flightAttendant')
 and coalesce(f->>'cancelled','false')<>'true' and coalesce(f->>'deletedAt','')=''
 and coalesce(f->>'compressorDryingTaskId','')=''
 and f->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')
 ), current_flight as (
 select f from today where coalesce(f->>'operationEndedAt','')='' and coalesce(f->>'actualShutdown','')='' and coalesce(f->>'shutdown','')<>'ok'
 order by (started is not null) desc,case when started is not null then started end desc,
 case when started is null then (f->>'date')||'T'||(f->>'departure') end,f->>'id' limit 1
 ), latest as (
 select f from today order by coalesce(nullif(f->>'actualShutdown',''),nullif(f->>'operationEndedAt',''),(f->>'date')||'T'||(f->>'departure')) desc,f->>'id' limit 1
 ) select coalesce((select private.current_aircraft_base(f->>'prefix') from current_flight),
 (select private.current_aircraft_base(f->>'prefix') from latest),private.current_crew_base())
$$;
revoke all on function private.current_crew_drying_base() from public,anon;
grant execute on function private.current_crew_drying_base() to authenticated;

drop policy "operational users read compressor drying queue" on public.compressor_drying_tasks;
create policy "operational users read compressor drying queue" on public.compressor_drying_tasks for select to authenticated
using(exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=(select auth.uid()) and u.active and
 (u.job_role not in('commander','copilot','flight_attendant') or (
 private.current_aircraft_base(compressor_drying_tasks.prefix)=(select private.current_crew_drying_base())
 and exists(select 1 from unnest(u.fleets) fleet where regexp_replace(upper(fleet),'[^A-Z0-9]','','g')=regexp_replace(upper(compressor_drying_tasks.model),'[^A-Z0-9]','','g'))))));

create or replace function public.complete_compressor_drying(p_task_id uuid)
returns public.compressor_drying_tasks language plpgsql security definer set search_path='' as $$
declare actor public.device_identities; role_name text; result public.compressor_drying_tasks; pilot_base text;
begin
 select * into actor from public.device_identities where auth_user_id=auth.uid();
 select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 select * into result from public.compressor_drying_tasks where id=p_task_id;
 if actor.auth_user_id is null or coalesce(role_name,'') not in('commander','copilot','mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','admin','app_manager') then raise exception 'Sem permissão para confirmar secagem';end if;
 if result.id is null then raise exception 'Secagem não encontrada';end if;
 if role_name in('commander','copilot') then
  pilot_base:=private.current_crew_drying_base();
  if not exists(select 1 from public.authorized_users u cross join lateral unnest(u.fleets) fleet where u.employee_number=actor.employee_number and u.active and regexp_replace(upper(fleet),'[^A-Z0-9]','','g')=regexp_replace(upper(result.model),'[^A-Z0-9]','','g')) then raise exception 'Frota não habilitada para este piloto';end if;
  if pilot_base is null or private.current_aircraft_base(result.prefix) is distinct from pilot_base then raise exception 'Secagem fora da sua base atual';end if;
 elsif role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and result.base is distinct from actor.assigned_base then raise exception 'Secagem fora da base';end if;
 perform 1 from public.runway_handovers where id=any(result.handover_ids) or (result.source_type='runway_handover' and id=result.source_id) order by id for update;
 update public.compressor_drying_tasks set status='completed',completed_by=actor.employee_number,completed_at=now() where id=p_task_id and status='pending' returning * into result;
 if result.id is null then select * into result from public.compressor_drying_tasks where id=p_task_id;end if;
 return result;
end $$;

