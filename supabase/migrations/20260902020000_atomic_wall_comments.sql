create or replace function public.add_operational_wall_comment(
  p_id text,
  p_body text,
  p_attachments jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity public.device_identities;
  v_current public.operational_wall_posts;
  v_at text := now()::text;
  v_comment jsonb;
  v_data jsonb;
  v_revision bigint;
begin
  select * into v_identity
  from public.device_identities
  where auth_user_id = auth.uid();

  if v_identity.auth_user_id is null then
    raise exception 'Aparelho não identificado';
  end if;

  select * into v_current
  from public.operational_wall_posts
  where id = p_id
  for update;

  if v_current.id is null then
    raise exception 'Publicação não encontrada';
  end if;

  if not (
    v_identity.is_admin
    or v_identity.access_profile = 'legacy'
    or v_current.audience_area = 'general'
    or v_current.audience_area = 'pilots' and v_identity.access_profile = 'pilot'
    or v_current.audience_area = 'coordination' and v_identity.access_profile = 'coordination'
    or v_current.audience_area = 'maintenance' and v_identity.access_profile = 'leader_inspector'
    or v_current.audience_area = 'maintenance' and v_identity.access_profile = 'mechanic'
      and (v_current.base = 'Todas' or v_identity.assigned_base is null or v_current.base = v_identity.assigned_base)
  ) then
    raise exception 'Publicação fora da sua área de acesso';
  end if;

  if length(trim(coalesce(p_body, ''))) > 4000 then
    raise exception 'Comentário excede 4000 caracteres';
  end if;

  if jsonb_typeof(coalesce(p_attachments, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 10 then
    raise exception 'Lista de anexos inválida';
  end if;

  if trim(coalesce(p_body, '')) = '' and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Comentário vazio';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) attachment
    where coalesce(attachment->>'url', '') not like p_id || '/comments/%'
  ) then
    raise exception 'Anexo fora da publicação';
  end if;

  v_comment := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'employeeNumber', v_identity.employee_number,
    'at', v_at,
    'body', trim(coalesce(p_body, '')),
    'attachments', coalesce(p_attachments, '[]'::jsonb)
  );

  v_data := jsonb_set(
    v_current.data,
    '{comments}',
    coalesce(v_current.data->'comments', '[]'::jsonb) || jsonb_build_array(v_comment),
    true
  );
  v_data := jsonb_set(
    v_data,
    '{history}',
    coalesce(v_data->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'employeeNumber', v_identity.employee_number,
      'at', v_at,
      'event', 'Adicionou um comentário'
    )),
    true
  );
  v_data := jsonb_set(v_data, '{updatedAt}', to_jsonb(v_at), true);
  v_data := jsonb_set(v_data, '{revision}', to_jsonb(v_current.revision + 1), true);

  update public.operational_wall_posts
  set data = v_data,
      revision = revision + 1,
      updated_at = now()
  where id = p_id
  returning revision into v_revision;

  return v_revision;
end;
$$;

revoke all on function public.add_operational_wall_comment(text, text, jsonb) from public, anon;
grant execute on function public.add_operational_wall_comment(text, text, jsonb) to authenticated;
