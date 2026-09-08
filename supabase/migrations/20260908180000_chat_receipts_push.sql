create table public.chat_receipts(message_id bigint references public.internal_messages(id),employee_number text,delivered_at timestamptz,read_at timestamptz,acknowledged_at timestamptz,primary key(message_id,employee_number));
alter table public.chat_receipts enable row level security;
revoke all on public.chat_receipts from anon,authenticated;
insert into public.chat_receipts(message_id,employee_number) select msg.id,mem.employee_number from public.internal_messages msg join public.internal_conversation_members mem on mem.conversation_id=msg.conversation_id where msg.sender<>mem.employee_number;
create table public.chat_push_jobs(message_id bigint references public.internal_messages(id),employee_number text,attempts int not null default 0,available_at timestamptz not null default now(),done boolean not null default false,primary key(message_id,employee_number));
alter table public.chat_push_jobs enable row level security;
revoke all on public.chat_push_jobs from anon,authenticated;
create function private.enqueue_chat_message() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.chat_receipts(message_id,employee_number) select new.id,m.employee_number from public.internal_conversation_members m where m.conversation_id=new.conversation_id and m.employee_number<>new.sender;
 if new.kind='message' then
 insert into public.chat_push_jobs(message_id,employee_number) select message_id,employee_number from public.chat_receipts where message_id=new.id;
 perform net.http_post(url:='https://ecdhhfyobalpswojaklv.supabase.co/functions/v1/send-chat-notifications',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='push_cron_secret')),body:='{}'::jsonb);
 end if;return new;end $$;
revoke all on function private.enqueue_chat_message() from public,anon,authenticated;
create trigger enqueue_chat after insert on public.internal_messages for each row execute function private.enqueue_chat_message();

create function public.chat_receipt(p_action text,p_conversation uuid,p_ids bigint[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;begin
 if not private.chat_member(p_conversation::text) then raise exception 'Você não participa desta conversa';end if;
 select employee_number into actor from public.device_identities where auth_user_id=auth.uid();
 if p_action in('delivered','read','ack') then
  insert into public.chat_receipts(message_id,employee_number) select msg.id,actor from public.internal_messages msg where msg.conversation_id=p_conversation and msg.id=any(p_ids) and msg.sender<>actor on conflict do nothing;
  update public.chat_receipts receipt set delivered_at=coalesce(receipt.delivered_at,clock_timestamp()),read_at=case when p_action in('read','ack') then coalesce(receipt.read_at,clock_timestamp()) else receipt.read_at end,acknowledged_at=case when p_action='ack' then coalesce(receipt.acknowledged_at,clock_timestamp()) else receipt.acknowledged_at end
  from public.internal_messages msg where receipt.message_id=msg.id and msg.conversation_id=p_conversation and receipt.employee_number=actor and msg.id=any(p_ids);
 elsif p_action<>'list' then raise exception 'Ação inválida';end if;
 return (select coalesce(jsonb_agg(to_jsonb(receipt)),'[]') from public.chat_receipts receipt join public.internal_messages msg on msg.id=receipt.message_id where msg.conversation_id=p_conversation and (cardinality(p_ids)=0 or msg.id=any(p_ids)));
end $$;
revoke all on function public.chat_receipt(text,uuid,bigint[]) from public,anon;
grant execute on function public.chat_receipt(text,uuid,bigint[]) to authenticated;

create function public.save_chat_push(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text) returns void language plpgsql security definer set search_path='' as $$
declare actor text;begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre novamente';end if;
 if p_endpoint not like 'https://%' or p_p256dh='' or p_auth='' then raise exception 'Inscrição inválida';end if;
 insert into public.push_subscriptions(auth_user_id,employee_number,endpoint,p256dh,auth,user_agent) values(auth.uid(),actor,p_endpoint,p_p256dh,p_auth,p_user_agent)
 on conflict(endpoint) do update set auth_user_id=excluded.auth_user_id,employee_number=excluded.employee_number,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now();
end $$;
revoke all on function public.save_chat_push(text,text,text,text) from public,anon;
grant execute on function public.save_chat_push(text,text,text,text) to authenticated;

create function public.claim_chat_push() returns setof public.chat_push_jobs language sql security definer set search_path='' as $$
 update public.chat_push_jobs set attempts=attempts+1,available_at=now()+interval '2 minutes' where (message_id,employee_number) in(select message_id,employee_number from public.chat_push_jobs where not done and attempts<5 and available_at<=now() order by available_at for update skip locked limit 50) returning *;
$$;
revoke all on function public.claim_chat_push() from public,anon,authenticated;
grant execute on function public.claim_chat_push() to service_role;
do $$ declare definition text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'select conv.*,','select conv.*, (select record_type from public.maintenance_records where id=conv.record_id) record_type,');
 execute definition;
end $$;
select cron.schedule('chat-push-retry','* * * * *',$cron$select net.http_post(url:='https://ecdhhfyobalpswojaklv.supabase.co/functions/v1/send-chat-notifications',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='push_cron_secret')),body:='{}'::jsonb);$cron$);
