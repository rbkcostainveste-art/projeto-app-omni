create or replace function public.save_shared_catalogs(p_catalogs jsonb)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_identity public.device_identities;
  v_revision bigint;
begin
  select * into v_identity
  from public.device_identities
  where auth_user_id=auth.uid();

  if v_identity.auth_user_id is null or not v_identity.is_admin then
    raise exception 'Somente o administrador altera cadastros';
  end if;

  update public.shared_app_state
  set catalogs=p_catalogs,
      revision=revision+1,
      updated_by=v_identity.employee_number,
      updated_at=now()
  where id='main'
  returning revision into v_revision;

  update public.authorized_users u
  set display_name=item.value->>'name',active=true
  from jsonb_array_elements(coalesce(p_catalogs->'users','[]'::jsonb)) item
  where u.employee_number=item.value->>'employeeNumber'
    and nullif(item.value->>'employeeNumber','') is not null;

  insert into public.authorized_users(employee_number,display_name,password_hash,is_admin)
  select item.value->>'employeeNumber',item.value->>'name',extensions.crypt('1234',extensions.gen_salt('bf')),false
  from jsonb_array_elements(coalesce(p_catalogs->'users','[]'::jsonb)) item
  where nullif(item.value->>'employeeNumber','') is not null
    and not exists(
      select 1 from public.authorized_users u
      where u.employee_number=item.value->>'employeeNumber'
    );

  return v_revision;
end;
$$;

revoke all on function public.save_shared_catalogs(jsonb) from public,anon;
grant execute on function public.save_shared_catalogs(jsonb) to authenticated;
