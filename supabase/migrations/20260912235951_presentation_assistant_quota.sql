-- Public presentation assistant: anonymous usage counters only. No conversations,
-- IP addresses, employee identities or operational records are stored or queried.
create table private.presentation_assistant_quota (
  scope text not null check (scope in ('minute', 'hour', 'day')),
  client_key text not null,
  window_start bigint not null,
  expires_at bigint not null,
  used integer not null check (used between 1 and 1000),
  primary key (scope, client_key, window_start),
  check (expires_at > window_start),
  check ((scope = 'day' and client_key = 'global') or
    (scope <> 'day' and client_key ~ '^[0-9a-f]{64}$'))
);
alter table private.presentation_assistant_quota enable row level security;
revoke all on table private.presentation_assistant_quota from public, anon, authenticated;
create index presentation_assistant_quota_expiry_idx
  on private.presentation_assistant_quota (expires_at);
comment on table private.presentation_assistant_quota is
  'Short-lived fixed-window counters. Client key is a server-generated daily HMAC. Expired counters are removed on the next valid request.';

create function private.consume_presentation_assistant_quota(p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now bigint;
  v_retry integer;
begin
  if p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid quota key' using errcode = '22023';
  end if;

  -- One transaction lock includes the global cap: changing keys cannot bypass it.
  -- There is intentionally no auth.uid() requirement for this public counter RPC.
  perform pg_catalog.pg_advisory_xact_lock(192013, 260912);
  v_now := floor(extract(epoch from pg_catalog.clock_timestamp()))::bigint;
  delete from private.presentation_assistant_quota where expires_at <= v_now;

  with windows(scope, client_key, width_seconds, allowance) as (
    values ('minute', p_client_key, 60, 8),
           ('hour', p_client_key, 3600, 60),
           ('day', 'global', 86400, 1000)
  )
  select max(q.expires_at - v_now)::integer into v_retry
  from windows w
  join private.presentation_assistant_quota q
    on q.scope = w.scope and q.client_key = w.client_key
    and q.window_start = (v_now / w.width_seconds) * w.width_seconds
  where q.used >= w.allowance;

  if v_retry is not null then
    return jsonb_build_object('allowed', false, 'retryAfter', greatest(1, v_retry));
  end if;

  insert into private.presentation_assistant_quota
    (scope, client_key, window_start, expires_at, used)
  select w.scope, w.client_key, (v_now / w.width_seconds) * w.width_seconds,
    ((v_now / w.width_seconds) + 1) * w.width_seconds, 1
  from (values ('minute', p_client_key, 60), ('hour', p_client_key, 3600),
    ('day', 'global', 86400)) as w(scope, client_key, width_seconds)
  on conflict (scope, client_key, window_start)
    do update set used = private.presentation_assistant_quota.used + 1;

  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end;
$$;
revoke all on function private.consume_presentation_assistant_quota(text)
  from public, anon, authenticated;
grant execute on function private.consume_presentation_assistant_quota(text)
  to anon, authenticated;

-- A parsed SQL body resolves the private function when created. This preserves
-- private schema isolation: no schema USAGE or table grant is needed by callers.
create function public.consume_presentation_assistant_quota(p_client_key text)
returns jsonb
language sql
security invoker
set search_path = ''
begin atomic
  select private.consume_presentation_assistant_quota(p_client_key);
end;
revoke all on function public.consume_presentation_assistant_quota(text)
  from public, anon, authenticated;
grant execute on function public.consume_presentation_assistant_quota(text)
  to anon, authenticated;
