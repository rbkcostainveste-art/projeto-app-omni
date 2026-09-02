alter table public.authorized_users add column if not exists job_role text;
alter table public.device_identities add column if not exists job_role text;

update public.authorized_users set job_role=case access_profile when 'pilot' then 'commander' when 'leader_inspector' then 'maintenance_leader' else access_profile end where job_role is null;
update public.device_identities set job_role=case access_profile when 'pilot' then 'commander' when 'leader_inspector' then 'maintenance_leader' else access_profile end where job_role is null;

alter table public.authorized_users drop constraint if exists authorized_users_job_role_check;
alter table public.authorized_users add constraint authorized_users_job_role_check check (job_role in ('legacy','admin','app_manager','mechanic','commander','copilot','flight_attendant','coordination','dispatch','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'));

create or replace function public.set_user_access_context(p_employee_number text,p_access_profile text,p_assigned_base text,p_fleets text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_group text;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador altera acessos'; end if;
  if p_access_profile='app_manager' and coalesce(v_identity.job_role,v_identity.access_profile)<>'admin' then raise exception 'Somente o ADM principal concede Gestor App'; end if;
  if p_access_profile not in ('legacy','admin','app_manager','mechanic','commander','copilot','flight_attendant','coordination','dispatch','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Função inválida'; end if;
  v_group:=case when p_access_profile in ('commander','copilot','flight_attendant') then 'pilot' when p_access_profile='dispatch' then 'coordination' when p_access_profile in ('maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then 'leader_inspector' when p_access_profile='app_manager' then 'admin' else p_access_profile end;
  update public.authorized_users set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile='maintenance_manager' then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
  update public.device_identities set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile='maintenance_manager' then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
end $$;

create or replace function public.claim_device_identity(p_employee_number text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile,job_role,assigned_base,fleets,mission,work_shift)
  values(v_uid,v_user.employee_number,v_user.is_admin,v_user.access_profile,v_user.job_role,v_user.assigned_base,v_user.fleets,v_user.mission,v_user.work_shift)
  on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,access_profile=excluded.access_profile,job_role=excluded.job_role,assigned_base=excluded.assigned_base,fleets=excluded.fleets,mission=excluded.mission,work_shift=excluded.work_shift,claimed_at=now();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',coalesce(v_user.job_role,v_user.access_profile),'assignedBase',v_user.assigned_base,'fleets',v_user.fleets,'mission',v_user.mission,'workShift',v_user.work_shift,'avatarDataUrl',v_user.avatar_data_url);
end $$;

create or replace function public.get_user_access_profiles()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],active boolean)
language plpgsql security definer set search_path='' as $$ declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador consulta acessos'; end if;
  return query select u.employee_number,u.display_name,coalesce(u.job_role,u.access_profile),u.assigned_base,u.fleets,u.active from public.authorized_users u order by u.employee_number;
end $$;

create or replace function public.get_operational_assignments()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],mission text,work_shift text,avatar_data_url text,active boolean)
language plpgsql security definer set search_path='' as $$ declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector','mechanic')) then raise exception 'Sem permissão para consultar pessoas'; end if;
  return query select u.employee_number,u.display_name,coalesce(u.job_role,u.access_profile),u.assigned_base,u.fleets,u.mission,u.work_shift,u.avatar_data_url,u.active from public.authorized_users u where u.active order by u.display_name,u.employee_number;
end $$;

create or replace function public.update_user_operational_assignment(p_employee_number text,p_assigned_base text,p_fleets text[],p_mission text,p_work_shift text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_target public.authorized_users; v_role text; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
  if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','coordination','maintenance_manager','maintenance_coordinator') then raise exception 'Sem permissão para alterar designações operacionais'; end if;
  select * into v_target from public.authorized_users where employee_number=p_employee_number and active;
  if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
  if coalesce(v_target.job_role,v_target.access_profile) not in ('mechanic','commander','copilot','flight_attendant','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Esta função não possui designação operacional'; end if;
  update public.authorized_users set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
  update public.device_identities set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
end $$;

create or replace function public.delete_authorized_user(p_employee_number text)
returns void language plpgsql security definer set search_path='' as $$ declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if coalesce(v_identity.job_role,v_identity.access_profile)<>'admin' then raise exception 'Somente o ADM principal exclui pessoas'; end if;
  if p_employee_number=v_identity.employee_number then raise exception 'O ADM não pode excluir o próprio cadastro'; end if;
  delete from public.device_identities where employee_number=p_employee_number;
  delete from public.authorized_users where employee_number=p_employee_number;
end $$;

create or replace function public.delete_own_operational_wall_post(p_id text)
returns void language plpgsql security definer set search_path='' as $$ declare v_identity public.device_identities; v_post public.operational_wall_posts; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid(); select * into v_post from public.operational_wall_posts where id=p_id for update;
  if v_post.id is null then raise exception 'Publicação não encontrada'; end if;
  if not v_identity.is_admin and coalesce(v_post.data->>'createdBy','')<>v_identity.employee_number then raise exception 'Você só pode apagar publicações que criou'; end if;
  delete from public.operational_wall_posts where id=p_id;
end $$;

create or replace function public.delete_maintenance_record(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if not v_identity.is_admin then raise exception 'Somente ADM ou Gestor App exclui registros técnicos'; end if;
  delete from public.maintenance_records where id=p_id;
end $$;

revoke all on function public.delete_authorized_user(text) from public,anon;
revoke all on function public.delete_maintenance_record(uuid) from public,anon;
grant execute on function public.delete_authorized_user(text) to authenticated;
grant execute on function public.delete_maintenance_record(uuid) to authenticated;
