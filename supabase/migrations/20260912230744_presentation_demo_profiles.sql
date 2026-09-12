-- Public product testing uses a new, non-administrator identity per anonymous
-- session. It uses the existing operational policies and shared records; it
-- never borrows the credentials or identity of an existing person.
create table private.presentation_demo_sessions (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employee_number text not null unique references public.authorized_users(employee_number),
  demo_profile text not null check (demo_profile in ('maintenance_leader','mechanic','commander','coordination','toolroom')),
  assigned_base text not null,
  created_at timestamptz not null default now()
);
alter table private.presentation_demo_sessions enable row level security;
revoke all on private.presentation_demo_sessions from public,anon,authenticated;

-- This helper and all privileged implementation functions stay outside the
-- exposed public schema. Public RPCs are narrow, explicitly granted wrappers;
-- the authenticated role receives no schema or table access to private state.
create function private.is_presentation_demo() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from private.presentation_demo_sessions where auth_user_id=auth.uid()
  );
$$;
revoke all on function private.is_presentation_demo() from public,anon;

-- Coordination can manage operational people in the existing app. Visitors
-- must never use that capability to grant themselves or someone else access.
create function private.guard_presentation_demo_accounts() returns trigger
language plpgsql security definer set search_path='' as $$
declare demo private.presentation_demo_sessions;
begin
  if private.is_presentation_demo() then
    raise exception 'O acesso demonstrativo não altera contas ou permissões' using errcode='42501';
  end if;
  if tg_op<>'DELETE' then
    select * into demo from private.presentation_demo_sessions where employee_number=new.employee_number;
    if found and (new.is_admin or new.job_role is distinct from demo.demo_profile or
      new.access_profile is distinct from case demo.demo_profile when 'maintenance_leader' then 'leader_inspector' when 'commander' then 'pilot' when 'toolroom' then 'mechanic' else demo.demo_profile end) then
      raise exception 'Identidades demonstrativas não podem receber outro perfil' using errcode='42501';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function private.guard_presentation_demo_accounts() from public,anon,authenticated;
create trigger guard_presentation_demo_accounts before insert or update or delete on public.authorized_users
for each row execute function private.guard_presentation_demo_accounts();

create function private.guard_presentation_demo_devices() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor private.presentation_demo_sessions; target private.presentation_demo_sessions;
begin
  select * into actor from private.presentation_demo_sessions where auth_user_id=auth.uid();
  if tg_op='DELETE' then
    if actor.auth_user_id is not null and old.auth_user_id<>actor.auth_user_id then
      raise exception 'O acesso demonstrativo não gerencia outros dispositivos' using errcode='42501';
    end if;
    return old;
  end if;
  if actor.auth_user_id is not null and (new.auth_user_id<>actor.auth_user_id or new.employee_number<>actor.employee_number) then
    raise exception 'O acesso demonstrativo não assume outra identidade' using errcode='42501';
  end if;
  select * into target from private.presentation_demo_sessions where employee_number=new.employee_number;
  if target.auth_user_id is not null and (
    new.auth_user_id<>target.auth_user_id or new.is_admin or new.job_role is distinct from target.demo_profile or
    new.access_profile is distinct from case target.demo_profile when 'maintenance_leader' then 'leader_inspector' when 'commander' then 'pilot' when 'toolroom' then 'mechanic' else target.demo_profile end
  ) then
    raise exception 'Identidade demonstrativa incompatível com esta sessão' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_presentation_demo_devices() from public,anon,authenticated;
create trigger guard_presentation_demo_devices before insert or update or delete on public.device_identities
for each row execute function private.guard_presentation_demo_devices();

create function private.begin_presentation_demo(p_profile text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); demo private.presentation_demo_sessions; person public.authorized_users;
  employee text; chosen_base text; group_name text; label text; models text[];
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and u.is_anonymous) then
    raise exception 'Inicie uma nova sessão de demonstração' using errcode='42501';
  end if;
  if p_profile is null or p_profile not in ('maintenance_leader','mechanic','commander','coordination','toolroom') then
    raise exception 'Perfil indisponível para demonstração' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  select * into demo from private.presentation_demo_sessions where auth_user_id=uid;
  if demo.auth_user_id is not null then
    if demo.demo_profile<>p_profile then raise exception 'Use uma nova sessão para mudar o perfil' using errcode='42501'; end if;
    select * into person from public.authorized_users where employee_number=demo.employee_number and active;
    if person.id is null then raise exception 'Demonstração desativada' using errcode='42501'; end if;
  else
    if exists(select 1 from public.device_identities where auth_user_id=uid) then
      raise exception 'Encerre a sessão atual antes de iniciar a demonstração' using errcode='42501';
    end if;
    select value into chosen_base from public.shared_app_state s,
      lateral jsonb_array_elements_text(coalesce(s.catalogs->'bases','[]')) b(value)
      where s.id='main' and nullif(trim(value),'') is not null and value not in ('A definir','Todas') limit 1;
    if chosen_base is null then raise exception 'A demonstração precisa de uma base cadastrada'; end if;
    select coalesce(array_agg(value),'{}') into models from public.shared_app_state s,
      lateral jsonb_array_elements_text(coalesce(s.catalogs->'models','[]')) m(value) where s.id='main';
    employee:='DEMO-'||replace(uid::text,'-','');
    group_name:=case p_profile when 'maintenance_leader' then 'leader_inspector' when 'commander' then 'pilot' when 'toolroom' then 'mechanic' else p_profile end;
    label:=case p_profile when 'maintenance_leader' then 'Liderança' when 'mechanic' then 'Mecânico' when 'commander' then 'Comandante' when 'coordination' then 'Coordenação' else 'Ferramentaria' end;
    insert into public.authorized_users(employee_number,display_name,password_hash,is_admin,access_profile,job_role,assigned_base,fleets,mission,work_shift,created_by)
    values(employee,'Visitante · '||label||' · '||left(uid::text,6),extensions.crypt(extensions.gen_random_uuid()::text,extensions.gen_salt('bf')),false,group_name,p_profile,chosen_base,
      case when p_profile='coordination' then '{}'::text[] else models end,
      case when p_profile in ('coordination','toolroom') then null else 'mission_1' end,
      case when p_profile in ('coordination','toolroom') then null else 'day' end,uid)
    returning * into person;
    insert into private.presentation_demo_sessions(auth_user_id,employee_number,demo_profile,assigned_base)
    values(uid,employee,p_profile,chosen_base);
  end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile,job_role,assigned_base,fleets,mission,work_shift)
  values(uid,person.employee_number,false,person.access_profile,person.job_role,person.assigned_base,person.fleets,person.mission,person.work_shift)
  on conflict(auth_user_id) do nothing;
  return jsonb_build_object('employeeNumber',person.employee_number,'displayName',person.display_name,'isAdmin',false,
    'accessProfile',p_profile,'assignedBase',person.assigned_base,'fleets',person.fleets,'mission',person.mission,
    'workShift',person.work_shift,'avatarDataUrl',null,'isPresentationDemo',true);
end;
$$;
revoke all on function private.begin_presentation_demo(text) from public,anon;
create function public.begin_presentation_demo(p_profile text) returns jsonb
language sql security definer set search_path='' as $$ select private.begin_presentation_demo(p_profile); $$;
revoke all on function public.begin_presentation_demo(text) from public,anon;
grant execute on function public.begin_presentation_demo(text) to authenticated;

-- A demo confirmation can only sign as its own visitor identity. It never
-- substitutes password verification for a person's regular authenticated login.
create function private.confirm_presentation_demo_action() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from private.presentation_demo_sessions s
    join public.device_identities d on d.auth_user_id=s.auth_user_id and d.employee_number=s.employee_number
    join public.authorized_users u on u.employee_number=s.employee_number and u.active
    where s.auth_user_id=auth.uid() and not d.is_admin and not u.is_admin and d.job_role=s.demo_profile and u.job_role=s.demo_profile) then
    raise exception 'Confirmação disponível somente na demonstração' using errcode='42501';
  end if;
  update public.device_identities set signature_verified_at=now(),last_seen_at=now() where auth_user_id=auth.uid();
  return true;
end;
$$;
revoke all on function private.confirm_presentation_demo_action() from public,anon;
create function public.confirm_presentation_demo_action() returns boolean
language sql security definer set search_path='' as $$ select private.confirm_presentation_demo_action(); $$;
revoke all on function public.confirm_presentation_demo_action() from public,anon;
grant execute on function public.confirm_presentation_demo_action() to authenticated;

create or replace function public.refresh_current_device() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_user public.authorized_users;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then return null; end if;
  select * into v_user from public.authorized_users where employee_number=v_identity.employee_number and active;
  if v_user.id is null then delete from public.device_identities where auth_user_id=auth.uid(); return null; end if;
  update public.device_identities set last_seen_at=now() where auth_user_id=auth.uid();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'displayName',v_user.display_name,'isAdmin',v_user.is_admin,
    'accessProfile',coalesce(v_user.job_role,v_user.access_profile),'assignedBase',v_user.assigned_base,'fleets',v_user.fleets,
    'mission',v_user.mission,'workShift',v_user.work_shift,'avatarDataUrl',v_user.avatar_data_url,'isPresentationDemo',private.is_presentation_demo());
end;
$$;
revoke all on function public.refresh_current_device() from public,anon;
grant execute on function public.refresh_current_device() to authenticated;
