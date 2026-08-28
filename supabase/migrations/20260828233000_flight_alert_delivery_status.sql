alter table public.flight_alerts
  add column if not exists status text not null default 'scheduled',
  add column if not exists status_detail text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_delivered_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text;

alter table public.flight_alerts drop constraint if exists flight_alerts_status_check;
alter table public.flight_alerts add constraint flight_alerts_status_check
  check (status in ('scheduled','sent','failed','closed','expired'));

drop function if exists public.get_my_flight_alerts();
create function public.get_my_flight_alerts()
returns table (
  flight_id text, minutes_before integer, enabled boolean, status text,
  status_detail text, last_attempt_at timestamptz,
  last_delivered_at timestamptz, closed_reason text
)
language sql security definer set search_path = '' stable as $$
  select alert.flight_id, alert.minutes_before, alert.enabled, alert.status,
    alert.status_detail, alert.last_attempt_at, alert.last_delivered_at, alert.closed_reason
  from public.flight_alerts alert
  where alert.auth_user_id = auth.uid();
$$;

drop function if exists public.set_flight_alert(text,integer,boolean);
create function public.set_flight_alert(
  p_flight_id text, p_minutes_before integer default 10,
  p_enabled boolean default true, p_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if p_minutes_before not between 1 and 1440 then raise exception 'Antecedência inválida'; end if;
  insert into public.flight_alerts(
    auth_user_id,flight_id,minutes_before,enabled,status,status_detail,
    last_attempt_at,last_delivered_at,closed_at,closed_reason,last_notified_arrival
  ) values (
    auth.uid(),p_flight_id,p_minutes_before,p_enabled,
    case when p_enabled then 'scheduled' else 'closed' end,null,
    null,null,case when p_enabled then null else now() end,
    case when p_enabled then null else coalesce(p_reason,'Desativado pelo usuário') end,null
  ) on conflict(auth_user_id,flight_id) do update set
    minutes_before=excluded.minutes_before, enabled=excluded.enabled,
    status=excluded.status, status_detail=null, last_attempt_at=null,
    last_delivered_at=null, closed_at=excluded.closed_at,
    closed_reason=excluded.closed_reason, last_notified_arrival=null, updated_at=now();
end $$;

create or replace function public.save_push_subscription_and_alert(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text,
  p_flight_id text, p_minutes_before integer default 10
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_identity public.device_identities;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  if p_minutes_before not between 1 and 1440 then raise exception 'Antecedência inválida'; end if;
  insert into public.push_subscriptions(auth_user_id,employee_number,endpoint,p256dh,auth,user_agent)
  values(auth.uid(),v_identity.employee_number,p_endpoint,p_p256dh,p_auth,p_user_agent)
  on conflict(endpoint) do update set auth_user_id=excluded.auth_user_id,employee_number=excluded.employee_number,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now();
  insert into public.flight_alerts(auth_user_id,flight_id,minutes_before,enabled,status,last_notified_arrival,status_detail,last_attempt_at,last_delivered_at,closed_at,closed_reason)
  values(auth.uid(),p_flight_id,p_minutes_before,true,'scheduled',null,null,null,null,null,null)
  on conflict(auth_user_id,flight_id) do update set minutes_before=excluded.minutes_before,enabled=true,status='scheduled',last_notified_arrival=null,status_detail=null,last_attempt_at=null,last_delivered_at=null,closed_at=null,closed_reason=null,updated_at=now();
end $$;

revoke all on function public.get_my_flight_alerts() from public, anon;
revoke all on function public.set_flight_alert(text,integer,boolean,text) from public, anon;
revoke all on function public.save_push_subscription_and_alert(text,text,text,text,text,integer) from public, anon;
grant execute on function public.get_my_flight_alerts() to authenticated;
grant execute on function public.set_flight_alert(text,integer,boolean,text) to authenticated;
grant execute on function public.save_push_subscription_and_alert(text,text,text,text,text,integer) to authenticated;
