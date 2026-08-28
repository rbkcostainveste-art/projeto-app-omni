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
  insert into public.flight_alerts(auth_user_id,flight_id,minutes_before,enabled,last_notified_arrival)
  values(auth.uid(),p_flight_id,p_minutes_before,true,null)
  on conflict(auth_user_id,flight_id) do update set minutes_before=excluded.minutes_before,enabled=true,last_notified_arrival=null,updated_at=now();
end $$;
revoke all on function public.save_push_subscription_and_alert(text,text,text,text,text,integer) from public;
grant execute on function public.save_push_subscription_and_alert(text,text,text,text,text,integer) to authenticated;
