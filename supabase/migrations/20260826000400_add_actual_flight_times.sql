alter table public.flights
  add column actual_engine_start_time time,
  add column actual_shutdown_time time;

comment on column public.flights.departure_time is 'Horário planejado de saída do voo';
comment on column public.flights.actual_engine_start_time is 'Horário real registrado ao confirmar o acionamento';
comment on column public.flights.actual_shutdown_time is 'Horário real registrado ao confirmar o corte';
