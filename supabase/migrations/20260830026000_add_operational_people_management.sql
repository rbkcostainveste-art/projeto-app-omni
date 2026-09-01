create or replace function public.get_operational_assignments()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],active boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector')) then
    raise exception 'Sem permissão para consultar a gestão operacional de pessoas';
  end if;
  return query
    select u.employee_number,u.display_name,u.access_profile,u.assigned_base,u.fleets,u.active
    from public.authorized_users u
    where u.active
    order by u.display_name,u.employee_number;
end $$;

revoke all on function public.get_operational_assignments() from public,anon;
grant execute on function public.get_operational_assignments() to authenticated;

create or replace function public.update_user_operational_assignment(p_employee_number text,p_assigned_base text,p_fleets text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_target public.authorized_users; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector')) then
    raise exception 'Sem permissão para alterar designações operacionais';
  end if;
  select * into v_target from public.authorized_users where employee_number=p_employee_number and active;
  if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
  if v_target.access_profile not in ('pilot','mechanic','leader_inspector') then
    raise exception 'Este perfil não possui designação operacional de base e frota';
  end if;
  update public.authorized_users
    set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}')
    where employee_number=p_employee_number;
  update public.device_identities
    set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}')
    where employee_number=p_employee_number;
end $$;

revoke all on function public.update_user_operational_assignment(text,text,text[]) from public,anon;
grant execute on function public.update_user_operational_assignment(text,text,text[]) to authenticated;
