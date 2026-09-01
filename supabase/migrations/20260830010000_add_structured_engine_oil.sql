alter table public.runway_handovers
  add column if not exists oil_additions jsonb;

comment on column public.runway_handovers.oil_additions is
  'Structured engine oil additions: engine1/engine2 with numeric amount and ml or L unit.';
