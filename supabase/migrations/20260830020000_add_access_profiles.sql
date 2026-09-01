alter table public.authorized_users
  add column if not exists access_profile text not null default 'legacy'
  check (access_profile in ('legacy','pilot','operations','mechanic','leader_inspector','admin'));

alter table public.device_identities
  add column if not exists access_profile text not null default 'legacy';

update public.authorized_users set access_profile='admin' where is_admin;
update public.device_identities set access_profile='admin' where is_admin;

create or replace function public.claim_device_identity(p_employee_number text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile)
  values(v_uid,v_user.employee_number,v_user.is_admin,v_user.access_profile)
  on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,access_profile=excluded.access_profile,claimed_at=now();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',v_user.access_profile);
end $$;

create or replace function public.set_user_access_profile(p_employee_number text,p_access_profile text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador altera acessos'; end if;
  if p_access_profile not in ('legacy','pilot','operations','mechanic','leader_inspector','admin') then raise exception 'Perfil inválido'; end if;
  update public.authorized_users set access_profile=p_access_profile,is_admin=(p_access_profile='admin') where employee_number=p_employee_number;
  update public.device_identities set access_profile=p_access_profile,is_admin=(p_access_profile='admin') where employee_number=p_employee_number;
end $$;

revoke all on function public.set_user_access_profile(text,text) from public,anon;
grant execute on function public.set_user_access_profile(text,text) to authenticated;

drop policy if exists "claimed devices read runway handovers" on public.runway_handovers;
create policy "maintenance reads runway handovers" on public.runway_handovers for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
);
drop policy if exists "claimed devices create runway handovers" on public.runway_handovers;
create policy "maintenance creates runway handovers" on public.runway_handovers for insert to authenticated with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
);
drop policy if exists "claimed devices update runway handovers" on public.runway_handovers;
create policy "maintenance updates runway handovers" on public.runway_handovers for update to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
) with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
);

alter table public.operational_wall_posts
  add column if not exists audience_area text not null default 'maintenance'
  check (audience_area in ('general','operations','maintenance'));

drop policy if exists "identified devices read operational wall" on public.operational_wall_posts;
create policy "users read authorized wall area" on public.operational_wall_posts for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (
    d.is_admin or d.access_profile='legacy' or audience_area='general' or
    audience_area='operations' and d.access_profile in ('pilot','operations') or
    audience_area='maintenance' and d.access_profile in ('mechanic','leader_inspector')
  ))
);

comment on column public.authorized_users.access_profile is 'Transitional RBAC profile. legacy preserves current access until an administrator classifies the user.';

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create or replace function private.enforce_shared_state_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if old.flights is distinct from new.flights and (v_identity.auth_user_id is null or v_identity.access_profile='pilot') then
    raise exception 'Seu perfil possui acesso somente para visualização do Trilho';
  end if;
  return new;
end $$;

drop trigger if exists enforce_shared_state_access on public.shared_app_state;
create trigger enforce_shared_state_access before update on public.shared_app_state
for each row execute function private.enforce_shared_state_access();

create or replace function private.enforce_wall_area_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_area text:=coalesce(new.audience_area,old.audience_area); begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (
    v_identity.is_admin or v_identity.access_profile='legacy' or
    v_area='general' or v_area='operations' and v_identity.access_profile in ('pilot','operations') or
    v_area='maintenance' and v_identity.access_profile in ('mechanic','leader_inspector')
  ) then raise exception 'Publicação fora da sua área de acesso'; end if;
  return new;
end $$;

drop trigger if exists enforce_wall_area_access on public.operational_wall_posts;
create trigger enforce_wall_area_access before update on public.operational_wall_posts
for each row execute function private.enforce_wall_area_access();
