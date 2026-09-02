alter table public.authorized_users drop constraint if exists authorized_users_job_role_check;
alter table public.authorized_users add constraint authorized_users_job_role_check check (job_role in ('legacy','admin','app_manager','mechanic','maintenance_assistant','toolroom','commander','copilot','flight_attendant','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'));

create or replace function public.set_user_access_context(p_employee_number text,p_access_profile text,p_assigned_base text,p_fleets text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_group text;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or coalesce(v_identity.job_role,v_identity.access_profile) not in ('admin','app_manager','legacy','coordination','maintenance_director','maintenance_manager','maintenance_coordinator') then raise exception 'Sem permissão para alterar acessos'; end if;
  if p_access_profile='app_manager' and coalesce(v_identity.job_role,v_identity.access_profile)<>'admin' then raise exception 'Somente o ADM principal concede Gestor App'; end if;
  if p_access_profile not in ('legacy','admin','app_manager','mechanic','maintenance_assistant','toolroom','commander','copilot','flight_attendant','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Função inválida'; end if;
  v_group:=case when p_access_profile in ('commander','copilot','flight_attendant') then 'pilot' when p_access_profile='dispatch' then 'coordination' when p_access_profile in ('maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then 'leader_inspector' when p_access_profile in ('maintenance_assistant','toolroom') then 'mechanic' when p_access_profile='app_manager' then 'admin' else p_access_profile end;
  update public.authorized_users set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile in ('maintenance_director','maintenance_manager') then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
  update public.device_identities set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile in ('maintenance_director','maintenance_manager') then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
end $$;

create or replace function public.update_user_operational_assignment(p_employee_number text,p_assigned_base text,p_fleets text[],p_mission text,p_work_shift text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_target public.authorized_users; v_role text;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
  if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','coordination','maintenance_director','maintenance_manager','maintenance_coordinator') then raise exception 'Sem permissão para alterar designações operacionais'; end if;
  select * into v_target from public.authorized_users where employee_number=p_employee_number;
  if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
  if coalesce(v_target.job_role,v_target.access_profile) not in ('mechanic','maintenance_assistant','toolroom','commander','copilot','flight_attendant','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Esta função não possui designação operacional'; end if;
  update public.authorized_users set assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
  update public.device_identities set assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
end $$;

revoke all on function public.set_user_access_context(text,text,text,text[]),public.update_user_operational_assignment(text,text,text[],text,text) from public,anon;
grant execute on function public.set_user_access_context(text,text,text,text[]),public.update_user_operational_assignment(text,text,text[],text,text) to authenticated;

do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_toolbox_dashboard()'::regprocedure) into v_definition;
  v_definition:=replace(v_definition,$roles$'admin','app_manager','legacy','mechanic','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$,$roles$'admin','app_manager','legacy','mechanic','maintenance_assistant','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$);
  execute v_definition;
  select pg_get_functiondef('public.toolbox_command(text,jsonb)'::regprocedure) into v_definition;
  v_definition:=replace(v_definition,$roles$'admin','app_manager','legacy','mechanic','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$,$roles$'admin','app_manager','legacy','mechanic','maintenance_assistant','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$);
  v_definition:=replace(v_definition,$roles$'admin','app_manager','legacy','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$,$roles$'admin','app_manager','legacy','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'$roles$);
  execute v_definition;
end $$;
