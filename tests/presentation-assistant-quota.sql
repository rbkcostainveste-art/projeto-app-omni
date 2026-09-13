-- Run as postgres; every counter and fixture change is rolled back.
begin;
select pg_advisory_xact_lock(192013, 260912);
delete from private.presentation_assistant_quota;

do $$
begin
  assert (select relrowsecurity from pg_class where oid =
    'private.presentation_assistant_quota'::regclass), 'Quota table requires RLS';
  assert not has_table_privilege('anon', 'private.presentation_assistant_quota',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), 'Anon must not access counters';
  assert not has_table_privilege('authenticated', 'private.presentation_assistant_quota',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), 'Authenticated must not access counters';
  assert not has_schema_privilege('anon', 'private', 'USAGE'), 'Do not expose private schema';
  assert not has_schema_privilege('authenticated', 'private', 'USAGE'), 'Keep private schema isolated';
  assert has_function_privilege('anon', 'public.consume_presentation_assistant_quota(text)',
    'EXECUTE'), 'Anonymous visitors need the narrow RPC';
  assert has_function_privilege('authenticated', 'public.consume_presentation_assistant_quota(text)',
    'EXECUTE'), 'Logged-in visitors need the narrow RPC';
  assert not (select prosecdef from pg_proc where oid =
    'public.consume_presentation_assistant_quota(text)'::regprocedure), 'Public wrapper must be invoker';
  assert not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a
    where p.oid in ('public.consume_presentation_assistant_quota(text)'::regprocedure,
      'private.consume_presentation_assistant_quota(text)'::regprocedure)
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 'PUBLIC execution must be revoked';
end $$;

set local role anon;
do $$
declare v_result jsonb;
begin
  assert auth.uid() is null, 'This test must work without a user identity';
  for i in 1..8 loop
    v_result := public.consume_presentation_assistant_quota(repeat('a', 64));
    assert v_result = '{"allowed":true,"retryAfter":0}'::jsonb, 'First 8 requests should pass';
  end loop;
  v_result := public.consume_presentation_assistant_quota(repeat('a', 64));
  assert (v_result->>'allowed')::boolean = false, 'Ninth minute request must be denied';
  assert (v_result->>'retryAfter')::integer between 1 and 60, 'Minute retry must fit window';
  assert (select count(*) from jsonb_object_keys(v_result)) = 2, 'No counters are disclosed';
  assert public.consume_presentation_assistant_quota(repeat('b', 64)) =
    '{"allowed":true,"retryAfter":0}'::jsonb, 'Separate clients have independent quotas';
  begin
    perform public.consume_presentation_assistant_quota('raw-ip-address');
    raise exception 'Malformed key unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.consume_presentation_assistant_quota(null);
    raise exception 'NULL key unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.consume_presentation_assistant_quota(repeat('A', 64));
    raise exception 'Noncanonical key unexpectedly accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform 1 from private.presentation_assistant_quota;
    raise exception 'Counter table unexpectedly readable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  assert (select used from private.presentation_assistant_quota where scope = 'day') = 9,
    'Rejected requests must not increment the daily allowance';
  assert (select used from private.presentation_assistant_quota where scope = 'minute'
    and client_key = repeat('a', 64)) = 8, 'Minute cap remains exact';
end $$;
-- Seed the hour boundary independently of wall-clock waiting.
update private.presentation_assistant_quota set used = 59 where scope = 'hour' and client_key = repeat('b', 64);
set local role authenticated;
do $$
declare v_result jsonb;
begin
  assert public.consume_presentation_assistant_quota(repeat('b', 64)) =
    '{"allowed":true,"retryAfter":0}'::jsonb, 'Sixtieth hourly request should pass';
  v_result := public.consume_presentation_assistant_quota(repeat('b', 64));
  assert (v_result->>'allowed')::boolean = false, 'Sixty-first hourly request must fail';
  assert (v_result->>'retryAfter')::integer between 1 and 3600, 'Hour retry must fit window';
end $$;
reset role;

-- An already expired window must be removed; a new client can still pass.
insert into private.presentation_assistant_quota values
  ('minute', repeat('e', 64), 60, 120, 8);
select public.consume_presentation_assistant_quota(repeat('c', 64));
do $$
begin
  assert not exists (select 1 from private.presentation_assistant_quota where expires_at = 120),
    'Expired counter must be purged';
end $$;

-- Global budget cannot be bypassed by choosing another well-formed client key.
update private.presentation_assistant_quota set used = 999 where scope = 'day';
set local role anon;
do $$
declare v_result jsonb;
begin
  assert public.consume_presentation_assistant_quota(repeat('d', 64)) =
    '{"allowed":true,"retryAfter":0}'::jsonb, 'Thousandth daily request should pass';
  v_result := public.consume_presentation_assistant_quota(repeat('f', 64));
  assert (v_result->>'allowed')::boolean = false, 'Global 1000 cap must deny a fresh key';
  assert (v_result->>'retryAfter')::integer between 1 and 86400, 'Daily retry must fit window';
end $$;
reset role;
do $$
begin
  assert (select used from private.presentation_assistant_quota where scope = 'day') = 1000,
    'Global cap must remain exact';
  assert not exists (select 1 from private.presentation_assistant_quota where client_key = repeat('f', 64)),
    'A blocked fresh key must not grow the table';
end $$;
select 'PASS: anonymous RPC, fixed limits, client isolation, global cap, invalid keys, TTL, private access' as result;
rollback;
