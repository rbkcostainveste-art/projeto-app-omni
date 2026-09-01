alter table public.operational_wall_posts drop constraint if exists operational_wall_posts_audience_area_check;
update public.operational_wall_posts set audience_area='pilots' where audience_area='operations';
alter table public.operational_wall_posts add constraint operational_wall_posts_audience_area_check
  check (audience_area in ('general','pilots','coordination','maintenance'));

drop policy if exists "authorized users read runway handovers" on public.runway_handovers;
drop policy if exists "maintenance reads runway handovers" on public.runway_handovers;
create policy "maintenance reads runway handovers" on public.runway_handovers for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
);

drop policy if exists "users read authorized wall area" on public.operational_wall_posts;
create policy "users read authorized wall area" on public.operational_wall_posts for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (
    d.is_admin or d.access_profile='legacy' or
    audience_area='general' or
    audience_area='pilots' and d.access_profile='pilot' or
    audience_area='coordination' and d.access_profile='coordination' or
    audience_area='maintenance' and d.access_profile='leader_inspector' or
    audience_area='maintenance' and d.access_profile='mechanic' and (base='Todas' or d.assigned_base is null or base=d.assigned_base)
  ))
);

drop policy if exists "leadership publishes operational wall posts" on public.operational_wall_posts;
create policy "leadership publishes operational wall posts" on public.operational_wall_posts for insert to authenticated with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (
    d.is_admin or d.access_profile='legacy' or d.access_profile='leader_inspector' and audience_area='maintenance'
  ))
);

create or replace function private.enforce_wall_area_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_area text:=coalesce(new.audience_area,old.audience_area); begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (
    v_identity.is_admin or v_identity.access_profile='legacy' or
    v_area='general' or
    v_area='pilots' and v_identity.access_profile='pilot' or
    v_area='coordination' and v_identity.access_profile='coordination' or
    v_area='maintenance' and v_identity.access_profile='leader_inspector' or
    v_area='maintenance' and v_identity.access_profile='mechanic' and (new.base='Todas' or v_identity.assigned_base is null or new.base=v_identity.assigned_base)
  ) then raise exception 'Publicação fora da sua área de acesso'; end if;
  return new;
end $$;

create or replace function public.update_operational_wall_post(p_id text,p_data jsonb,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.operational_wall_posts; v_revision bigint; v_leadership boolean; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  select * into v_current from public.operational_wall_posts where id=p_id for update;
  if v_current.id is null then raise exception 'Publicação não encontrada'; end if;
  if not (v_identity.is_admin or v_identity.access_profile='legacy' or v_current.audience_area='general' or v_current.audience_area='pilots' and v_identity.access_profile='pilot' or v_current.audience_area='coordination' and v_identity.access_profile='coordination' or v_current.audience_area='maintenance' and v_identity.access_profile='leader_inspector' or v_current.audience_area='maintenance' and v_identity.access_profile='mechanic' and (v_current.base='Todas' or v_identity.assigned_base is null or v_current.base=v_identity.assigned_base)) then raise exception 'Publicação fora da sua área de acesso'; end if;
  if v_current.revision<>p_expected_revision then raise exception 'Publicação alterada por outro usuário'; end if;
  v_leadership:=v_identity.is_admin or v_identity.access_profile='legacy' or v_identity.access_profile='leader_inspector' and v_current.audience_area='maintenance';
  if not v_leadership then
    if (p_data-array['comments','views','acknowledgements','history','actions','updatedAt','revision'])<>(v_current.data-array['comments','views','acknowledgements','history','actions','updatedAt','revision']) then raise exception 'Somente a liderança altera o conteúdo oficial'; end if;
    if jsonb_array_length(coalesce(p_data->'actions','[]'))<>jsonb_array_length(coalesce(v_current.data->'actions','[]')) or exists(select 1 from jsonb_array_elements(coalesce(p_data->'actions','[]')) proposed where not exists(select 1 from jsonb_array_elements(coalesce(v_current.data->'actions','[]')) original where original->>'id'=proposed->>'id' and (original-array['status','views','acknowledgements','executions'])=(proposed-array['status','views','acknowledgements','executions']))) then raise exception 'Somente a liderança altera a definição das ações'; end if;
  end if;
  update public.operational_wall_posts set base=case when v_leadership then coalesce(p_data->>'base',base) else base end,pinned=case when v_leadership then coalesce((p_data->>'pinned')::boolean,pinned) else pinned end,essential=case when v_leadership then coalesce((p_data->>'essential')::boolean,essential) else essential end,resolved=case when v_leadership then coalesce((p_data->>'resolved')::boolean,resolved) else resolved end,data=p_data,revision=revision+1,updated_at=now() where id=p_id returning revision into v_revision;
  return v_revision;
end $$;

drop policy if exists "users read authorized wall media" on storage.objects;
drop policy if exists "users upload authorized wall media" on storage.objects;
create policy "users read authorized wall media" on storage.objects for select to authenticated using (
  bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=(select auth.uid()) where p.id=split_part(storage.objects.name,'/',1) and (d.is_admin or d.access_profile='legacy' or p.audience_area='general' or p.audience_area='pilots' and d.access_profile='pilot' or p.audience_area='coordination' and d.access_profile='coordination' or p.audience_area='maintenance' and d.access_profile='leader_inspector' or p.audience_area='maintenance' and d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)))
);
create policy "users upload authorized wall media" on storage.objects for insert to authenticated with check (
  bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=(select auth.uid()) where p.id=split_part(storage.objects.name,'/',1) and (d.is_admin or d.access_profile='legacy' or p.audience_area='general' or p.audience_area='pilots' and d.access_profile='pilot' or p.audience_area='coordination' and d.access_profile='coordination' or p.audience_area='maintenance' and d.access_profile='leader_inspector' or p.audience_area='maintenance' and d.access_profile='mechanic' and (p.base='Todas' or d.assigned_base is null or p.base=d.assigned_base)))
);
