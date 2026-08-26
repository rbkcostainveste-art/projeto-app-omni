create index if not exists flight_acknowledgements_user_idx
  on public.flight_acknowledgements (user_id);

create index if not exists flight_audit_log_actor_idx
  on public.flight_audit_log (actor_id);

create index if not exists flights_created_by_idx
  on public.flights (created_by);

create index if not exists flights_updated_by_idx
  on public.flights (updated_by);
