drop trigger if exists clear_fixed_crew_base on public.authorized_users;
drop trigger if exists clear_fixed_crew_base on public.device_identities;

CREATE OR REPLACE FUNCTION public.update_user_operational_assignment(p_employee_number text, p_assigned_base text, p_fleets text[], p_mission text, p_work_shift text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_identity public.device_identities; v_target public.authorized_users; v_role text;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid(); select coalesce(u.job_role,u.access_profile) into v_role from public.authorized_users u where u.employee_number=v_identity.employee_number and u.active;
  if v_identity.auth_user_id is null or coalesce(v_role,'') not in ('admin','app_manager','legacy','coordination','maintenance_director','maintenance_manager','maintenance_coordinator') then raise exception 'Sem permissão para alterar designações operacionais'; end if;
  select * into v_target from public.authorized_users where employee_number=p_employee_number;
  if v_role='coordination' and coalesce(v_target.job_role,v_target.access_profile,'') not in ('commander','copilot','flight_attendant') then raise exception 'Coordenação pode gerir somente a tripulação';end if;
  if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
  if coalesce(v_target.job_role,v_target.access_profile) not in ('mechanic','maintenance_assistant','toolroom','commander','copilot','flight_attendant','coordination','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Esta função não possui designação operacional'; end if;
  if coalesce(v_target.job_role,v_target.access_profile)='coordination' then p_fleets:='{}'::text[]; p_mission:=null; p_work_shift:=null; end if;
  update public.authorized_users set assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
  update public.device_identities set assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
end $function$;

CREATE OR REPLACE FUNCTION public.update_user_avatar(p_employee_number text, p_avatar_data_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.employee_number=p_employee_number or v_identity.is_admin or v_identity.access_profile='admin' or (exists(select 1 from public.authorized_users a where a.employee_number=v_identity.employee_number and a.active and a.job_role='coordination') and exists(select 1 from public.authorized_users t where t.employee_number=p_employee_number and t.active and t.job_role in('commander','copilot','flight_attendant')))) then
    raise exception 'Sem permissão para alterar esta foto';
  end if;
  if p_avatar_data_url is not null and (p_avatar_data_url !~ '^data:image/(jpeg|png|webp);base64,' or length(p_avatar_data_url)>350000) then
    raise exception 'Imagem inválida ou muito grande';
  end if;
  update public.authorized_users set avatar_data_url=nullif(p_avatar_data_url,'') where employee_number=p_employee_number and active;
  if not found then raise exception 'Usuário não encontrado'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.current_crew_base()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with actor as (
 select u.employee_number,u.assigned_base from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=auth.uid() and u.active and u.job_role in('commander','copilot','flight_attendant')
 ), candidates as (
 select f,coalesce(nullif(f->>'operationStartedAt',''),nullif(f->>'actualEngineStart','')) started
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f cross join actor a
 where s.id='main' and a.employee_number in(f->>'commander',f->>'copilot',f->>'flightAttendant')
 and coalesce(f->>'cancelled','false')<>'true' and coalesce(f->>'deletedAt','')=''
 and coalesce(f->>'compressorDryingTaskId','')='' and coalesce(f->>'operationEndedAt','')=''
 and coalesce(f->>'actualShutdown','')='' and coalesce(f->>'shutdown','')<>'ok'
 ), selected as (
 select f from candidates where started is not null or f->>'date'>=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')
 order by (started is not null) desc,case when started is not null then started end desc,
 case when started is null then (f->>'date')||'T'||(f->>'departure') end,f->>'id' limit 1
 ) select coalesce((select nullif(assigned_base,'') from actor),(select private.current_aircraft_base(f->>'prefix') from selected))
$function$;

CREATE OR REPLACE FUNCTION private.current_crew_drying_base()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with actor as (
 select u.employee_number,u.assigned_base from public.device_identities d join public.authorized_users u using(employee_number)
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
 ) select coalesce((select nullif(assigned_base,'') from actor),(select private.current_aircraft_base(f->>'prefix') from current_flight),
 (select private.current_aircraft_base(f->>'prefix') from latest),private.current_crew_base())
$function$;
