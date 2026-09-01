alter table public.maintenance_records
  drop constraint if exists maintenance_records_priority_check;

alter table public.maintenance_records
  add constraint maintenance_records_priority_check
  check (priority in ('routine', 'urgent', 'logged', 'not_logged'));
