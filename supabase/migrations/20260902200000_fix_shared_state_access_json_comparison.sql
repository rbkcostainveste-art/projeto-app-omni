create or replace function private.enforce_shared_state_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_identity public.device_identities;
  v_old jsonb;
  v_new jsonb;
begin
  select * into v_identity
  from public.device_identities
  where auth_user_id = auth.uid();

  if v_identity.auth_user_id is null then
    raise exception 'Aparelho não identificado';
  end if;

  if v_identity.is_admin or v_identity.access_profile in ('legacy','leader_inspector','mechanic') then
    return new;
  end if;

  if v_identity.access_profile = 'pilot' then
    if new.catalogs <> old.catalogs then
      raise exception 'Piloto não altera cadastros';
    end if;

    for v_new in select value from jsonb_array_elements(new.flights) loop
      select value into v_old
      from jsonb_array_elements(old.flights)
      where value->>'id' = v_new->>'id'
      limit 1;

      if v_old is not null and (
        v_new->'fuel' is distinct from v_old->'fuel' or
        v_new->'preflight' is distinct from v_old->'preflight' or
        v_new->'hums' is distinct from v_old->'hums'
      ) then
        raise exception 'Piloto não confirma Abastecimento, Pré-voo ou HUMS';
      end if;
    end loop;

    return new;
  end if;

  if v_identity.access_profile = 'coordination' then
    for v_new in select value from jsonb_array_elements(new.flights) loop
      select value into v_old
      from jsonb_array_elements(old.flights)
      where value->>'id' = v_new->>'id'
      limit 1;

      if v_old is not null and (
        v_new->'fuel' is distinct from v_old->'fuel' or
        v_new->'preflight' is distinct from v_old->'preflight' or
        v_new->'hums' is distinct from v_old->'hums' or
        v_new->'engineStart' is distinct from v_old->'engineStart' or
        v_new->'actualEngineStart' is distinct from v_old->'actualEngineStart' or
        v_new->'shutdown' is distinct from v_old->'shutdown' or
        v_new->'actualShutdown' is distinct from v_old->'actualShutdown'
      ) then
        raise exception 'Coordenação não confirma checklist, decolagem ou corte';
      end if;
    end loop;

    return new;
  end if;

  raise exception 'Seu perfil não pode alterar o trilho';
end $$;

notify pgrst, 'reload schema';
