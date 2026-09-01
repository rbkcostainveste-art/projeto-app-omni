alter table public.authorized_users add column if not exists avatar_data_url text;

alter table public.authorized_users drop constraint if exists authorized_users_avatar_size_check;
alter table public.authorized_users add constraint authorized_users_avatar_size_check
  check (avatar_data_url is null or length(avatar_data_url) <= 350000);

create or replace function public.get_user_directory()
returns table(employee_number text,display_name text,avatar_data_url text)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Identidade não reconhecida'; end if;
  return query select u.employee_number,u.display_name,u.avatar_data_url
    from public.authorized_users u where u.active order by u.display_name,u.employee_number;
end $$;

revoke all on function public.get_user_directory() from public,anon;
grant execute on function public.get_user_directory() to authenticated;

create or replace function public.update_user_avatar(p_employee_number text,p_avatar_data_url text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.employee_number=p_employee_number or v_identity.is_admin or v_identity.access_profile='admin') then
    raise exception 'Sem permissão para alterar esta foto';
  end if;
  if p_avatar_data_url is not null and (p_avatar_data_url !~ '^data:image/(jpeg|png|webp);base64,' or length(p_avatar_data_url)>350000) then
    raise exception 'Imagem inválida ou muito grande';
  end if;
  update public.authorized_users set avatar_data_url=nullif(p_avatar_data_url,'') where employee_number=p_employee_number and active;
  if not found then raise exception 'Usuário não encontrado'; end if;
end $$;

revoke all on function public.update_user_avatar(text,text) from public,anon;
grant execute on function public.update_user_avatar(text,text) to authenticated;

drop function if exists public.get_operational_assignments();
create function public.get_operational_assignments()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],mission text,work_shift text,avatar_data_url text,active boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector')) then
    raise exception 'Sem permissão para consultar a gestão operacional de pessoas';
  end if;
  return query select u.employee_number,u.display_name,u.access_profile,u.assigned_base,u.fleets,u.mission,u.work_shift,u.avatar_data_url,u.active
    from public.authorized_users u where u.active order by u.display_name,u.employee_number;
end $$;

revoke all on function public.get_operational_assignments() from public,anon;
grant execute on function public.get_operational_assignments() to authenticated;

create or replace function public.claim_device_identity(p_employee_number text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile,assigned_base,fleets,mission,work_shift)
  values(v_uid,v_user.employee_number,v_user.is_admin,v_user.access_profile,v_user.assigned_base,v_user.fleets,v_user.mission,v_user.work_shift)
  on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,access_profile=excluded.access_profile,assigned_base=excluded.assigned_base,fleets=excluded.fleets,mission=excluded.mission,work_shift=excluded.work_shift,claimed_at=now();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',v_user.access_profile,'assignedBase',v_user.assigned_base,'fleets',v_user.fleets,'mission',v_user.mission,'workShift',v_user.work_shift,'avatarDataUrl',v_user.avatar_data_url);
end $$;

revoke all on function public.claim_device_identity(text,text) from public,anon;
grant execute on function public.claim_device_identity(text,text) to authenticated;
