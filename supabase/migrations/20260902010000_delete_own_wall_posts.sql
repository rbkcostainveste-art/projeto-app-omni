create or replace function public.delete_own_operational_wall_post(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity public.device_identities;
  v_post public.operational_wall_posts;
begin
  select * into v_identity
  from public.device_identities
  where auth_user_id = auth.uid();

  if v_identity.auth_user_id is null or not (
    v_identity.is_admin
    or v_identity.access_profile in ('legacy', 'leader_inspector')
  ) then
    raise exception 'Somente ADM, líderes e inspetores podem apagar publicações';
  end if;

  select * into v_post
  from public.operational_wall_posts
  where id = p_id
  for update;

  if v_post.id is null then
    raise exception 'Publicação não encontrada';
  end if;

  if coalesce(v_post.data->>'createdBy', '') <> v_identity.employee_number then
    raise exception 'Você só pode apagar publicações que criou';
  end if;

  delete from public.operational_wall_posts where id = p_id;
end;
$$;

revoke all on function public.delete_own_operational_wall_post(text) from public, anon;
grant execute on function public.delete_own_operational_wall_post(text) to authenticated;
