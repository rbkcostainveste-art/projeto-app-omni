alter table public.aircraft
  add column if not exists unavailable boolean not null default false,
  add column if not exists unavailability_reason text,
  add column if not exists availability_updated_by uuid references public.profiles(id),
  add column if not exists availability_updated_at timestamptz;

alter table public.flights
  add column if not exists fuel_unit text not null default 'L' check (fuel_unit in ('L', 'lb')),
  add column if not exists cancelled boolean not null default false,
  add column if not exists cancellation_reason text,
  add column if not exists action_signatures jsonb not null default '{}'::jsonb;

create index if not exists flights_next_action_idx
on public.flights (flight_date, cancelled, departure_time);
create index if not exists aircraft_availability_updated_by_idx on public.aircraft (availability_updated_by);
create index if not exists authorized_users_created_by_idx on public.authorized_users (created_by);

comment on column public.flights.action_signatures is 'Última matrícula responsável por cada campo operacional';
comment on column public.aircraft.unavailable is 'Impede novos lançamentos enquanto a aeronave estiver indisponível';
