create table if not exists public.runway_handovers (
  id text primary key,
  prefix text not null,
  model text not null,
  base text not null,
  date date not null,
  opened_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  checks jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  discrepancy_details text not null default '',
  oil_quantity text not null default '',
  notes text not null default '',
  revision bigint not null default 0
);

alter table public.runway_handovers enable row level security;

revoke all on public.runway_handovers from anon, authenticated;
grant select, insert, update, delete on public.runway_handovers to authenticated;

drop policy if exists "claimed devices read runway handovers" on public.runway_handovers;
create policy "claimed devices read runway handovers"
on public.runway_handovers for select to authenticated
using (exists (
  select 1 from public.device_identities d
  where d.auth_user_id = (select auth.uid())
));

drop policy if exists "claimed devices create runway handovers" on public.runway_handovers;
create policy "claimed devices create runway handovers"
on public.runway_handovers for insert to authenticated
with check (exists (
  select 1 from public.device_identities d
  where d.auth_user_id = (select auth.uid())
    and d.employee_number = created_by
));

drop policy if exists "claimed devices update runway handovers" on public.runway_handovers;
create policy "claimed devices update runway handovers"
on public.runway_handovers for update to authenticated
using (exists (
  select 1 from public.device_identities d
  where d.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.device_identities d
  where d.auth_user_id = (select auth.uid())
));

drop policy if exists "admins delete runway handovers" on public.runway_handovers;
create policy "admins delete runway handovers"
on public.runway_handovers for delete to authenticated
using (exists (
  select 1 from public.device_identities d
  where d.auth_user_id = (select auth.uid()) and d.is_admin
));

insert into public.runway_handovers (
  id, prefix, model, base, date, opened_at, updated_at, created_by,
  checks, actions, discrepancy_details, oil_quantity, notes, revision
)
select
  item->>'id',
  coalesce(item->>'prefix', ''),
  coalesce(item->>'model', ''),
  coalesce(item->>'base', ''),
  (item->>'date')::date,
  (item->>'openedAt')::timestamptz,
  (item->>'updatedAt')::timestamptz,
  coalesce(item->>'createdBy', ''),
  coalesce(item->'checks', '{}'::jsonb),
  coalesce(item->'actions', '{}'::jsonb),
  coalesce(item->>'discrepancyDetails', ''),
  coalesce(item->>'oilQuantity', ''),
  coalesce(item->>'notes', ''),
  coalesce((item->>'revision')::bigint, 0)
from public.shared_app_state state
cross join lateral jsonb_array_elements(coalesce(state.passages, '[]'::jsonb)) item
where state.id = 'main'
  and nullif(item->>'id', '') is not null
  and nullif(item->>'date', '') is not null
  and nullif(item->>'openedAt', '') is not null
  and nullif(item->>'updatedAt', '') is not null
on conflict (id) do nothing;

update public.shared_app_state
set passages = '[]'::jsonb
where id = 'main' and jsonb_array_length(passages) > 0;

create index if not exists runway_handovers_date_updated_at_idx
  on public.runway_handovers (date, updated_at desc);
create index if not exists runway_handovers_filter_idx
  on public.runway_handovers (date, base, model, prefix);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'runway_handovers'
  ) then
    alter publication supabase_realtime add table public.runway_handovers;
  end if;
end $$;
