alter table public.authorized_users add column if not exists mission text;
alter table public.authorized_users add column if not exists work_shift text;
alter table public.device_identities add column if not exists mission text;
alter table public.device_identities add column if not exists work_shift text;

alter table public.authorized_users drop constraint if exists authorized_users_mission_check;
alter table public.authorized_users add constraint authorized_users_mission_check check (mission is null or mission in ('mission_1','mission_2'));
alter table public.authorized_users drop constraint if exists authorized_users_work_shift_check;
alter table public.authorized_users add constraint authorized_users_work_shift_check check (work_shift is null or work_shift in ('day','night'));

create table if not exists public.maintenance_records (
  id uuid primary key,
  record_type text not null check (record_type in ('fault','discrepancy','inspection')),
  base text not null,
  model text not null,
  prefix text not null,
  priority text not null default 'routine' check (priority in ('routine','urgent')),
  status text not null default 'open' check (status in ('open','closed')),
  title text not null,
  tc text,
  source_flight_id uuid,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  data jsonb not null default '{}'::jsonb
);

create index if not exists maintenance_records_scope_idx on public.maintenance_records(base,model,prefix,record_type,status,priority,updated_at desc);
alter table public.maintenance_records enable row level security;
revoke all on table public.maintenance_records from anon,authenticated;
grant select,insert on table public.maintenance_records to authenticated;

create policy "maintenance reads technical records" on public.maintenance_records for select to authenticated using (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')) and (d.assigned_base is null or d.access_profile in ('legacy','leader_inspector') or d.assigned_base=maintenance_records.base))
);
create policy "maintenance creates technical records" on public.maintenance_records for insert to authenticated with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')))
);

create or replace function public.update_maintenance_record(p_id uuid,p_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.maintenance_records; v_next_status text; v_revision bigint; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','mechanic','leader_inspector')) then raise exception 'Sem acesso à manutenção'; end if;
  select * into v_current from public.maintenance_records where id=p_id for update;
  if v_current.id is null then raise exception 'Registro não encontrado'; end if;
  v_next_status:=coalesce(p_data->>'status',v_current.status);
  if v_next_status<>v_current.status and not (v_identity.is_admin or v_identity.access_profile in ('legacy','leader_inspector')) then raise exception 'Somente inspetor ou liderança encerra e reabre registros'; end if;
  update public.maintenance_records set status=v_next_status,priority=coalesce(p_data->>'priority',priority),tc=nullif(p_data->>'tc',''),data=p_data,revision=revision+1,updated_at=now() where id=p_id returning revision into v_revision;
  return v_revision;
end $$;
revoke all on function public.update_maintenance_record(uuid,jsonb) from public,anon;
grant execute on function public.update_maintenance_record(uuid,jsonb) to authenticated;

drop function if exists public.get_operational_assignments();
create function public.get_operational_assignments()
returns table(employee_number text,display_name text,access_profile text,assigned_base text,fleets text[],mission text,work_shift text,active boolean)
language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector')) then raise exception 'Sem permissão para consultar a gestão operacional de pessoas'; end if;
  return query select u.employee_number,u.display_name,u.access_profile,u.assigned_base,u.fleets,u.mission,u.work_shift,u.active from public.authorized_users u where u.active order by u.display_name,u.employee_number;
end $$;
revoke all on function public.get_operational_assignments() from public,anon;
grant execute on function public.get_operational_assignments() to authenticated;

drop function if exists public.update_user_operational_assignment(text,text,text[]);
create function public.update_user_operational_assignment(p_employee_number text,p_assigned_base text,p_fleets text[],p_mission text,p_work_shift text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_target public.authorized_users; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector')) then raise exception 'Sem permissão para alterar designações operacionais'; end if;
  select * into v_target from public.authorized_users where employee_number=p_employee_number and active;
  if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
  if v_target.access_profile not in ('pilot','mechanic','leader_inspector') then raise exception 'Este perfil não possui designação operacional'; end if;
  update public.authorized_users set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
  update public.device_identities set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
end $$;
revoke all on function public.update_user_operational_assignment(text,text,text[],text,text) from public,anon;
grant execute on function public.update_user_operational_assignment(text,text,text[],text,text) to authenticated;

grant select,insert on table public.maintenance_records to authenticated;
alter publication supabase_realtime add table public.maintenance_records;
