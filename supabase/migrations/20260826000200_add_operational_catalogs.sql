create table public.operation_bases (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.aircraft_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.aircraft (
  id uuid primary key default gen_random_uuid(),
  prefix text not null unique,
  model_id uuid not null references public.aircraft_models(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.operation_bases enable row level security;
alter table public.aircraft_models enable row level security;
alter table public.aircraft enable row level security;

revoke all on table public.operation_bases, public.aircraft_models, public.aircraft from anon, authenticated;
grant select, insert, update, delete on table public.operation_bases, public.aircraft_models, public.aircraft to authenticated;

create policy "Authenticated users read operation bases" on public.operation_bases for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated users read aircraft models" on public.aircraft_models for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated users read aircraft" on public.aircraft for select to authenticated using ((select auth.uid()) is not null);

create policy "Administrators insert operation bases" on public.operation_bases for insert to authenticated with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update operation bases" on public.operation_bases for update to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true') with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete operation bases" on public.operation_bases for delete to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators insert aircraft models" on public.aircraft_models for insert to authenticated with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update aircraft models" on public.aircraft_models for update to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true') with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete aircraft models" on public.aircraft_models for delete to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators insert aircraft" on public.aircraft for insert to authenticated with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update aircraft" on public.aircraft for update to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true') with check ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete aircraft" on public.aircraft for delete to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');

create index aircraft_model_id_idx on public.aircraft (model_id);

insert into public.operation_bases (name) values ('Jacarepaguá'), ('Macaé'), ('Cabo Frio'), ('Vitória');
insert into public.aircraft_models (name) values ('H145'), ('AW139'), ('S-76C++'), ('H225');
insert into public.aircraft (prefix, model_id)
select seed.prefix, models.id from (values ('PR-OMN', 'H145'), ('PP-AZU', 'S-76C++'), ('PR-LFT', 'AW139')) as seed(prefix, model_name)
join public.aircraft_models models on models.name = seed.model_name;
