drop policy if exists "authenticated users can read authorized users" on public.authorized_users;
revoke select on public.authorized_users from authenticated;

create or replace function public.get_user_access_profiles()
returns table(employee_number text,display_name text,access_profile text,active boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador consulta acessos'; end if;
  return query select u.employee_number,u.display_name,u.access_profile,u.active from public.authorized_users u order by u.employee_number;
end $$;

revoke all on function public.get_user_access_profiles() from public,anon;
grant execute on function public.get_user_access_profiles() to authenticated;
