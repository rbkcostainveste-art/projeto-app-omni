alter table public.device_identities add column if not exists signature_verified_at timestamptz;

create or replace function public.verify_signature_password(p_password text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_user public.authorized_users;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  select * into v_user from public.authorized_users where employee_number=v_identity.employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then return false; end if;
  update public.device_identities set signature_verified_at=now(),last_seen_at=now() where auth_user_id=auth.uid();
  return true;
end $$;

revoke all on function public.verify_signature_password(text) from public,anon;
grant execute on function public.verify_signature_password(text) to authenticated;
