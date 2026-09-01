alter table public.authorized_users add column if not exists assigned_base text;
alter table public.authorized_users add column if not exists fleets text[] not null default '{}';
alter table public.device_identities add column if not exists assigned_base text;
alter table public.device_identities add column if not exists fleets text[] not null default '{}';

alter table public.authorized_users drop constraint if exists authorized_users_access_profile_check;
alter table public.authorized_users add constraint authorized_users_access_profile_check
  check (access_profile in ('legacy','pilot','operations','coordination','mechanic','leader_inspector','admin'));
update public.authorized_users set access_profile='coordination' where access_profile='operations';
update public.device_identities set access_profile='coordination' where access_profile='operations';

create or replace function public.claim_device_identity(p_employee_number text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile,assigned_base,fleets)
  values(v_uid,v_user.employee_number,v_user.is_admin,v_user.access_profile,v_user.assigned_base,v_user.fleets)
  on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,access_profile=excluded.access_profile,assigned_base=excluded.assigned_base,fleets=excluded.fleets,claimed_at=now();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',v_user.access_profile,'assignedBase',v_user.assigned_base,'fleets',v_user.fleets);
end $$;

create or replace function public.set_user_access_context(p_employee_number text,p_access_profile text,p_assigned_base text,p_fleets text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador altera acessos'; end if;
  if p_access_profile not in ('legacy','pilot','coordination','mechanic','leader_inspector','admin') then raise exception 'Perfil inválido'; end if;
  update public.authorized_users set access_profile=p_access_profile,is_admin=(p_access_profile='admin'),assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
  update public.device_identities set access_profile=p_access_profile,is_admin=(p_access_profile='admin'),assigned_base=nullif(p_assigned_base,''),fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
end $$;
revoke all on function public.set_user_access_context(text,text,text,text[]) from public,anon;
grant execute on function public.set_user_access_context(text,text,text,text[]) to authenticated;

drop function if exists public.get_user_access_profiles();
create function public.get_user_access_profiles()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],active boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador consulta acessos'; end if;
  return query select u.employee_number,u.display_name,u.access_profile,u.assigned_base,u.fleets,u.active from public.authorized_users u order by u.employee_number;
end $$;

drop trigger if exists enforce_shared_state_access on public.shared_app_state;

create or replace function private.enforce_shared_state_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_old jsonb; v_new jsonb; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  if v_identity.is_admin or v_identity.access_profile in ('legacy','leader_inspector','mechanic') then return new; end if;
  if v_identity.access_profile='pilot' then
    if new.catalogs<>old.catalogs then raise exception 'Piloto não altera cadastros'; end if;
    for v_new in select value from jsonb_array_elements(new.flights) loop
      select value into v_old from jsonb_array_elements(old.flights) where value->>'id'=v_new->>'id' limit 1;
      if v_old is not null and (v_new->array['fuel','preflight','hums'])<>(v_old->array['fuel','preflight','hums']) then raise exception 'Piloto não confirma Abastecimento, Pré-voo ou HUMS'; end if;
    end loop;
    return new;
  end if;
  if v_identity.access_profile='coordination' then
    for v_new in select value from jsonb_array_elements(new.flights) loop
      select value into v_old from jsonb_array_elements(old.flights) where value->>'id'=v_new->>'id' limit 1;
      if v_old is not null and (v_new->array['fuel','preflight','hums','engineStart','actualEngineStart','shutdown','actualShutdown'])<>(v_old->array['fuel','preflight','hums','engineStart','actualEngineStart','shutdown','actualShutdown']) then raise exception 'Coordenação não confirma checklist, decolagem ou corte'; end if;
    end loop;
    return new;
  end if;
  raise exception 'Seu perfil não pode alterar o trilho';
end $$;
create trigger enforce_shared_state_access before update on public.shared_app_state for each row execute function private.enforce_shared_state_access();

drop policy if exists "maintenance reads runway handovers" on public.runway_handovers;
create policy "authorized users read runway handovers" on public.runway_handovers for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','pilot','leader_inspector') or d.access_profile='mechanic' and (d.assigned_base is null or d.assigned_base=runway_handovers.base)))
);

drop policy if exists "users read authorized wall area" on public.operational_wall_posts;
create policy "users read authorized wall area" on public.operational_wall_posts for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (
    d.is_admin or d.access_profile in ('legacy','leader_inspector') or
    audience_area='general' and (d.access_profile='pilot' or d.access_profile='mechanic' and (base='Todas' or d.assigned_base is null or base=d.assigned_base)) or
    audience_area='operations' and d.access_profile='pilot' or
    audience_area='maintenance' and d.access_profile='mechanic' and (base='Todas' or d.assigned_base is null or base=d.assigned_base)
  ))
);
drop policy if exists "administrators publish operational wall posts" on public.operational_wall_posts;
create policy "leadership publishes operational wall posts" on public.operational_wall_posts for insert to authenticated with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','leader_inspector')))
);

create or replace function public.update_operational_wall_post(p_id text,p_data jsonb,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.operational_wall_posts; v_revision bigint; v_leadership boolean; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  if v_identity.access_profile='coordination' then raise exception 'Coordenação não acessa o mural'; end if;
  select * into v_current from public.operational_wall_posts where id=p_id for update;
  if v_current.id is null then raise exception 'Publicação não encontrada'; end if;
  if v_current.revision<>p_expected_revision then raise exception 'Publicação alterada por outro usuário'; end if;
  v_leadership:=v_identity.is_admin or v_identity.access_profile in ('legacy','leader_inspector');
  if not v_leadership then
    if (p_data-array['comments','views','acknowledgements','history','actions','updatedAt','revision'])<>(v_current.data-array['comments','views','acknowledgements','history','actions','updatedAt','revision']) then raise exception 'Somente a liderança altera o conteúdo oficial'; end if;
    if jsonb_array_length(coalesce(p_data->'actions','[]'))<>jsonb_array_length(coalesce(v_current.data->'actions','[]')) or exists(
      select 1 from jsonb_array_elements(coalesce(p_data->'actions','[]')) proposed where not exists(
        select 1 from jsonb_array_elements(coalesce(v_current.data->'actions','[]')) original where original->>'id'=proposed->>'id' and (original-array['status','views','acknowledgements','executions'])=(proposed-array['status','views','acknowledgements','executions'])
      )
    ) then raise exception 'Somente a liderança altera a definição das ações'; end if;
  end if;
  update public.operational_wall_posts set base=case when v_leadership then coalesce(p_data->>'base',base) else base end,pinned=case when v_leadership then coalesce((p_data->>'pinned')::boolean,pinned) else pinned end,essential=case when v_leadership then coalesce((p_data->>'essential')::boolean,essential) else essential end,resolved=case when v_leadership then coalesce((p_data->>'resolved')::boolean,resolved) else resolved end,data=p_data,revision=revision+1,updated_at=now() where id=p_id returning revision into v_revision;
  return v_revision;
end $$;

create or replace function public.update_aircraft_management(p_prefix text,p_base text default null,p_available boolean default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_state public.shared_app_state; v_aircraft jsonb; v_item jsonb; v_index integer; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or v_identity.access_profile not in ('legacy','coordination','leader_inspector','admin') then raise exception 'Sem permissão para gerir aeronaves'; end if;
  if p_available is not null and not (v_identity.is_admin or v_identity.access_profile in ('legacy','leader_inspector')) then raise exception 'Seu perfil só pode alterar a base'; end if;
  select * into v_state from public.shared_app_state where id='main' for update;
  v_aircraft:=coalesce(v_state.catalogs->'aircraft','[]'::jsonb);
  select ordinality-1,value into v_index,v_item from jsonb_array_elements(v_aircraft) with ordinality where value->>'prefix'=p_prefix limit 1;
  if v_item is null then raise exception 'Aeronave não encontrada'; end if;
  if p_base is not null then v_item:=jsonb_set(v_item,'{base}',to_jsonb(p_base),true); end if;
  if p_available is not null then
    v_item:=jsonb_set(v_item,'{available}',to_jsonb(p_available),true);
    v_item:=jsonb_set(v_item,'{unavailabilityReason}',to_jsonb(coalesce(p_reason,'')),true);
    v_item:=jsonb_set(v_item,'{availabilityUpdatedBy}',to_jsonb(v_identity.employee_number),true);
  end if;
  v_aircraft:=jsonb_set(v_aircraft,array[v_index::text],v_item,false);
  update public.shared_app_state set catalogs=jsonb_set(catalogs,'{aircraft}',v_aircraft,true),revision=revision+1,updated_by=v_identity.employee_number,updated_at=now() where id='main' returning catalogs into v_item;
  return v_item;
end $$;
revoke all on function public.update_aircraft_management(text,text,boolean,text) from public,anon;
grant execute on function public.update_aircraft_management(text,text,boolean,text) to authenticated;

drop policy if exists "users read authorized wall media" on storage.objects;
drop policy if exists "users upload authorized wall media" on storage.objects;
create policy "users read authorized wall media" on storage.objects for select to authenticated using (
  bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=(select auth.uid()) where p.id=split_part(storage.objects.name,'/',1) and (
    d.is_admin or d.access_profile in ('legacy','leader_inspector') or p.audience_area='general' and (d.access_profile='pilot' or d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)) or p.audience_area='operations' and d.access_profile='pilot' or p.audience_area='maintenance' and d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)))
);
create policy "users upload authorized wall media" on storage.objects for insert to authenticated with check (
  bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=(select auth.uid()) where p.id=split_part(storage.objects.name,'/',1) and (
    d.is_admin or d.access_profile in ('legacy','leader_inspector') or p.audience_area='general' and (d.access_profile='pilot' or d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)) or p.audience_area='operations' and d.access_profile='pilot' or p.audience_area='maintenance' and d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)))
);
