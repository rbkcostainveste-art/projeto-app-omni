create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_number text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(), prefix text not null, aircraft_model text not null,
  operation_base text not null, flight_date date not null, departure_time time not null,
  estimated_duration numeric(5,2) not null check (estimated_duration > 0),
  fuel_amount numeric(10,2) not null default 0 check (fuel_amount >= 0),
  fuel_status text not null default 'pending' check (fuel_status in ('pending','ok','no')),
  preflight_status text not null default 'pending' check (preflight_status in ('pending','ok','no')),
  hums_status text not null default 'pending' check (hums_status in ('pending','ok','no')),
  engine_start_status text not null default 'pending' check (engine_start_status in ('pending','ok','no')),
  shutdown_status text not null default 'pending' check (shutdown_status in ('pending','ok','no')),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.flight_acknowledgements (
  flight_id uuid not null references public.flights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null check (revision > 0), acknowledged_at timestamptz not null default now(),
  primary key (flight_id, user_id)
);

create table if not exists public.flight_audit_log (
  id bigint generated always as identity primary key,
  flight_id uuid not null references public.flights(id) on delete cascade,
  actor_id uuid not null references public.profiles(id), action text not null,
  changes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.flights enable row level security;
alter table public.flight_acknowledgements enable row level security;
alter table public.flight_audit_log enable row level security;
revoke all on table public.profiles, public.flights, public.flight_acknowledgements, public.flight_audit_log from anon, authenticated;
grant select, insert, update on table public.profiles, public.flights, public.flight_acknowledgements to authenticated;
grant select, insert on table public.flight_audit_log to authenticated;
create policy "Authenticated users read profiles" on public.profiles for select to authenticated using ((select auth.uid()) is not null);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Authenticated users read flights" on public.flights for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated users create flights" on public.flights for insert to authenticated with check ((select auth.uid()) = created_by and (select auth.uid()) = updated_by);
create policy "Authenticated users update active flights" on public.flights for update to authenticated using ((select auth.uid()) is not null and shutdown_status <> 'ok') with check ((select auth.uid()) = updated_by);
create policy "Authenticated users read acknowledgements" on public.flight_acknowledgements for select to authenticated using ((select auth.uid()) is not null);
create policy "Users create own acknowledgements" on public.flight_acknowledgements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own acknowledgements" on public.flight_acknowledgements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Authenticated users read audit log" on public.flight_audit_log for select to authenticated using ((select auth.uid()) is not null);
create policy "Users create own audit entries" on public.flight_audit_log for insert to authenticated with check ((select auth.uid()) = actor_id);
create index if not exists flights_timeline_idx on public.flights (flight_date desc, departure_time desc);
create index if not exists flights_filters_idx on public.flights (operation_base, aircraft_model, prefix);
create index if not exists flight_audit_log_flight_idx on public.flight_audit_log (flight_id, created_at desc);
