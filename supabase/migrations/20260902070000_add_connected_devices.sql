alter table public.device_identities
  add column if not exists device_label text,
  add column if not exists user_agent text,
  add column if not exists last_seen_at timestamptz not null default now();

create or replace function public.activate_current_device(p_device_label text,p_user_agent text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  update public.device_identities
     set device_label=left(coalesce(nullif(trim(p_device_label),''),'Dispositivo'),120),
         user_agent=left(coalesce(p_user_agent,''),500),
         last_seen_at=now()
   where auth_user_id=auth.uid();
  if not found then raise exception 'Aparelho não identificado'; end if;
end $$;

create or replace function public.refresh_current_device()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_user public.authorized_users;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then return null; end if;
  select * into v_user from public.authorized_users where employee_number=v_identity.employee_number and active;
  if v_user.id is null then delete from public.device_identities where auth_user_id=auth.uid(); return null; end if;
  update public.device_identities set last_seen_at=now() where auth_user_id=auth.uid();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',coalesce(v_user.job_role,v_user.access_profile),'assignedBase',v_user.assigned_base,'fleets',v_user.fleets,'mission',v_user.mission,'workShift',v_user.work_shift,'avatarDataUrl',v_user.avatar_data_url);
end $$;

create or replace function public.list_my_connected_devices()
returns table(auth_user_id uuid,device_label text,user_agent text,claimed_at timestamptz,last_seen_at timestamptz,is_current boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities;
begin
  select * into v_identity from public.device_identities where device_identities.auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  return query
    select d.auth_user_id,coalesce(d.device_label,'Dispositivo'),coalesce(d.user_agent,''),d.claimed_at,d.last_seen_at,d.auth_user_id=auth.uid()
      from public.device_identities d
     where d.employee_number=v_identity.employee_number
     order by (d.auth_user_id=auth.uid()) desc,d.last_seen_at desc;
end $$;

create or replace function public.disconnect_my_device(p_auth_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  delete from public.device_identities d where d.auth_user_id=p_auth_user_id and d.employee_number=v_identity.employee_number;
  return found;
end $$;

revoke all on function public.activate_current_device(text,text),public.refresh_current_device(),public.list_my_connected_devices(),public.disconnect_my_device(uuid) from public,anon;
grant execute on function public.activate_current_device(text,text),public.refresh_current_device(),public.list_my_connected_devices(),public.disconnect_my_device(uuid) to authenticated;
