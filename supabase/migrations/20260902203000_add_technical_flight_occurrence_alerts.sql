create or replace function public.create_technical_flight_occurrence_alert(
  p_flight_id text,
  p_reason text,
  p_occurrence_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity public.device_identities;
  v_state public.shared_app_state;
  v_flight jsonb;
  v_id text := 'technical-flight-occurrence-' || p_flight_id;
  v_at text := now()::text;
  v_prefix text;
  v_base text;
  v_title text;
  v_body text;
  v_data jsonb;
begin
  select * into v_identity
  from public.device_identities
  where auth_user_id = auth.uid();

  if v_identity.auth_user_id is null then
    raise exception 'Aparelho não identificado';
  end if;

  if lower(trim(p_reason)) not in ('pane', 'indisponível', 'indisponivel') then
    raise exception 'Esta ocorrência não é técnica';
  end if;

  if p_occurrence_type not in ('returned', 'cancelled') then
    raise exception 'Tipo de ocorrência inválido';
  end if;

  select * into v_state
  from public.shared_app_state
  where id = 'main';

  select value into v_flight
  from jsonb_array_elements(coalesce(v_state.flights, '[]'::jsonb))
  where value ->> 'id' = p_flight_id
  limit 1;

  if v_flight is null then
    raise exception 'Voo não encontrado';
  end if;

  if coalesce(v_identity.job_role, v_identity.access_profile) in ('commander', 'copilot') then
    if v_identity.employee_number not in (coalesce(v_flight ->> 'commander', ''), coalesce(v_flight ->> 'copilot', '')) then
      raise exception 'Este voo não pertence à sua tripulação';
    end if;
  elsif coalesce(v_identity.job_role, v_identity.access_profile) not in (
    'legacy', 'admin', 'app_manager', 'coordination', 'mechanic', 'maintenance_assistant',
    'maintenance_director', 'maintenance_manager', 'maintenance_coordinator',
    'maintenance_leader', 'maintenance_inspector', 'leader_inspector'
  ) then
    raise exception 'Usuário sem permissão para registrar ocorrência técnica';
  end if;

  v_prefix := coalesce(v_flight ->> 'prefix', 'Aeronave');
  v_base := coalesce(nullif(v_flight ->> 'base', ''), 'Todas');
  v_title := case
    when p_occurrence_type = 'returned' then v_prefix || ' retornando por ' || lower(trim(p_reason))
    else v_prefix || ' indisponível antes da decolagem'
  end;
  v_body := case
    when p_occurrence_type = 'returned' then 'Alerta à manutenção: retorno técnico registrado no Trilho. A aeronave permanece em voo até o registro do corte.'
    else 'Alerta à manutenção: ocorrência técnica registrada antes da decolagem.'
  end;




  v_data := jsonb_build_object(
    'id', v_id,
    'title', v_title,
    'body', v_body,
    'base', v_base,
    'audienceArea', 'maintenance',
    'category', 'Ocorrência técnica de voo',
    'priority', 'critical',
    'pinned', false,
    'essential', true,
    'resolved', false,
    'createdBy', v_identity.employee_number,
    'createdAt', v_at,
    'updatedAt', v_at,
    'revision', 1,
    'attachments', '[]'::jsonb,
    'actions', '[]'::jsonb,
    'comments', '[]'::jsonb,
    'views', '[]'::jsonb,
    'acknowledgements', '[]'::jsonb,
    'history', jsonb_build_array(jsonb_build_object(
      'employeeNumber', v_identity.employee_number,
      'at', v_at,
      'event', case when p_occurrence_type = 'returned' then 'Registrou retorno técnico para a manutenção' else 'Registrou indisponibilidade técnica para a manutenção antes da decolagem' end
    )),
    'sourceFlightId', p_flight_id,
    'technicalOccurrenceReason', trim(p_reason),
    'technicalOccurrenceType', p_occurrence_type
  );

  insert into public.operational_wall_posts(
    id, base, audience_area, pinned, essential, resolved, revision, data
  ) values (
    v_id, v_base, 'maintenance', false, true, false, 1, v_data
  )
  on conflict (id) do update set
    base = excluded.base,
    audience_area = excluded.audience_area,
    essential = excluded.essential,
    resolved = false,
    revision = public.operational_wall_posts.revision + 1,
    data = jsonb_set(excluded.data, '{revision}', to_jsonb(public.operational_wall_posts.revision + 1), true),
    updated_at = now();

  return v_id;
end;
$$;

revoke all on function public.create_technical_flight_occurrence_alert(text, text, text) from public, anon;
grant execute on function public.create_technical_flight_occurrence_alert(text, text, text) to authenticated;
