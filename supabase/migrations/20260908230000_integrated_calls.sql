-- Call metadata is retained; short-lived WebRTC negotiation is not technical history.
create table public.chat_calls (
 id uuid primary key, conversation_id uuid not null references public.internal_conversations(id),
 started_by text not null, mode text not null check(mode in('audio','video')),
 created_at timestamptz not null default now(), ended_at timestamptz
);
create unique index chat_calls_one_active on public.chat_calls(conversation_id) where ended_at is null;
create table public.chat_call_members (
 call_id uuid not null references public.chat_calls(id), employee_number text not null,
 session_id uuid, state text not null default 'invited' check(state in('invited','joined','left','declined')),
 joined_at timestamptz, left_at timestamptz, heartbeat timestamptz,
 primary key(call_id,employee_number)
);
create index chat_call_members_employee on public.chat_call_members(employee_number,call_id);
create table public.chat_call_signals (
 id bigint generated always as identity primary key, request_id uuid not null unique,
 call_id uuid not null references public.chat_calls(id), sender uuid not null, recipient uuid not null,
 payload jsonb not null, created_at timestamptz not null default now()
);
create index chat_call_signals_recipient on public.chat_call_signals(call_id,recipient,id);
create index chat_call_signals_expiry on public.chat_call_signals(created_at);
alter table public.chat_calls enable row level security;
alter table public.chat_call_members enable row level security;
alter table public.chat_call_signals enable row level security;
revoke all on public.chat_calls,public.chat_call_members,public.chat_call_signals from anon,authenticated;

create function private.finish_chat_call() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.ended_at is null and new.ended_at is not null then
  update public.chat_call_members set state='left',left_at=new.ended_at where call_id=new.id and state='joined';
  delete from public.chat_call_signals where call_id=new.id;
  insert into public.internal_messages(request_id,conversation_id,sender,body) values(gen_random_uuid(),new.conversation_id,new.started_by,
   'Chamada encerrada · '||case when exists(select 1 from public.chat_call_members where call_id=new.id and employee_number<>new.started_by and joined_at is not null) then 'Participaram: '||(select string_agg(coalesce(u.display_name,m.employee_number),' · ') from public.chat_call_members m left join public.authorized_users u using(employee_number) where m.call_id=new.id and m.joined_at is not null) else 'Não atendida' end);
  update public.internal_conversations set updated_at=clock_timestamp() where id=new.conversation_id;
 end if;return new;
end $$;
revoke all on function private.finish_chat_call() from public,anon,authenticated;
create trigger finish_chat_call after update of ended_at on public.chat_calls for each row execute function private.finish_chat_call();

create function private.expire_chat_calls() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.chat_call_members set state='left',left_at=now() where state='joined' and heartbeat<now()-interval '45 seconds';
 update public.chat_calls c set ended_at=now() where c.ended_at is null and (
  not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.state='joined') or
  (c.created_at<now()-interval '60 seconds' and not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.employee_number<>c.started_by and m.joined_at is not null)));
 delete from public.chat_call_signals where created_at<now()-interval '5 minutes';
end $$;
revoke all on function private.expire_chat_calls() from public,anon,authenticated;
select cron.schedule('expire-chat-calls','* * * * *','select private.expire_chat_calls()');

create function public.chat_call(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; callrow public.chat_calls; cid uuid; sid uuid; target uuid; result jsonb;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 if p_action='incoming' then
  return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
   select c.*,u.display_name caller_name,v.title from public.chat_calls c
   join public.chat_call_members m on m.call_id=c.id and m.employee_number=actor
   join public.internal_conversations v on v.id=c.conversation_id
   left join public.authorized_users u on u.employee_number=c.started_by
   where c.ended_at is null and m.state='invited' and private.chat_member(c.conversation_id::text)
   and c.created_at>now()-interval '60 seconds'
   and exists(select 1 from public.chat_call_members x where x.call_id=c.id and x.state='joined' and x.heartbeat>now()-interval '45 seconds')
   order by c.created_at desc limit 10) t);
 end if;
 sid:=(p_payload->>'session')::uuid;
 if p_action='start' then
  cid:=(p_payload->>'conversation')::uuid;
  if not private.chat_member(cid::text) then raise exception 'Você não participa desta conversa';end if;
  perform pg_advisory_xact_lock(hashtextextended('chat-call:'||actor,0));
  perform 1 from public.internal_conversations where id=cid for update;
  update public.chat_calls c set ended_at=now() where c.conversation_id=cid and c.ended_at is null and not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.state='joined' and m.heartbeat>now()-interval '45 seconds');
  select * into callrow from public.chat_calls where conversation_id=cid and ended_at is null;
  if callrow.id is null then
   if sid is null or coalesce(p_payload->>'mode','') not in('audio','video') then raise exception 'Chamada inválida';end if;
   if exists(select 1 from public.chat_call_members m join public.chat_calls c on c.id=m.call_id where m.employee_number=actor and m.state='joined' and m.heartbeat>now()-interval '45 seconds' and c.ended_at is null) then raise exception 'Você já está em outra chamada';end if;
   insert into public.chat_calls(id,conversation_id,started_by,mode) values((p_payload->>'id')::uuid,cid,actor,p_payload->>'mode') returning * into callrow;
   insert into public.chat_call_members(call_id,employee_number) select callrow.id,m.employee_number from public.internal_conversation_members m join public.authorized_users u using(employee_number) where m.conversation_id=cid and u.active;
   perform public.internal_chat('send',jsonb_build_object('id',cid,'requestId',gen_random_uuid(),'body','Chamada de '||case when callrow.mode='video' then 'vídeo' else 'voz' end||' no aplicativo. Abra a conversa para atender.'));
  end if;
 else
  select * into callrow from public.chat_calls where id=(p_payload->>'id')::uuid;
  if callrow.id is null or not private.chat_member(callrow.conversation_id::text) then raise exception 'Chamada indisponível';end if;
 end if;
 if p_action in('start','join') then
  perform pg_advisory_xact_lock(hashtextextended('chat-call:'||actor,0));
  perform 1 from public.chat_calls where id=callrow.id for update;
  if exists(select 1 from public.chat_calls where id=callrow.id and ended_at is not null) then raise exception 'Chamada encerrada';end if;
  if sid is null then raise exception 'Sessão obrigatória';end if;
  if exists(select 1 from public.chat_call_members m join public.chat_calls c on c.id=m.call_id where m.employee_number=actor and m.state='joined' and m.heartbeat>now()-interval '45 seconds' and c.ended_at is null and (m.call_id<>callrow.id or m.session_id<>sid)) then raise exception 'Você já está em uma chamada em outro dispositivo';end if;
  if (select count(*) from public.chat_call_members where call_id=callrow.id and state='joined' and heartbeat>now()-interval '45 seconds' and employee_number<>actor)>=6 then raise exception 'Limite de seis pessoas nesta chamada';end if;
  insert into public.chat_call_members(call_id,employee_number,session_id,state,joined_at,heartbeat) values(callrow.id,actor,sid,'joined',now(),now())
  on conflict(call_id,employee_number) do update set session_id=excluded.session_id,state='joined',joined_at=coalesce(chat_call_members.joined_at,now()),left_at=null,heartbeat=now();
 elsif p_action='decline' then
  update public.chat_call_members set state='declined',left_at=now() where call_id=callrow.id and employee_number=actor and state='invited';
 elsif p_action in('poll','signal','leave') then
  if not exists(select 1 from public.chat_call_members where call_id=callrow.id and employee_number=actor and session_id=sid and state='joined') then raise exception 'Você não está nesta chamada';end if;
  if p_action='leave' then
   update public.chat_call_members set state='left',left_at=now() where call_id=callrow.id and employee_number=actor and session_id=sid;
   update public.chat_calls c set ended_at=now() where c.id=callrow.id and c.ended_at is null and ((select count(*) from public.chat_call_members where call_id=c.id)<=2 or not exists(select 1 from public.chat_call_members where call_id=c.id and state='joined' and heartbeat>now()-interval '45 seconds'));
  else
   if callrow.ended_at is not null then return jsonb_build_object('ended',true);end if;
   update public.chat_call_members set heartbeat=now() where call_id=callrow.id and employee_number=actor and session_id=sid and heartbeat<now()-interval '10 seconds';
   if p_action='signal' then
    target:=(p_payload->>'recipient')::uuid;
    if not exists(select 1 from public.chat_call_members m join public.authorized_users u using(employee_number) where m.call_id=callrow.id and m.session_id=target and m.state='joined' and u.active and m.employee_number<>actor) then raise exception 'Destinatário não está na chamada';end if;
    if coalesce(p_payload->'signal'->>'type','') not in('offer','answer','ice') or octet_length((p_payload->'signal')::text)>65000 then raise exception 'Sinal inválido';end if;
    if (select count(*) from public.chat_call_signals where call_id=callrow.id and sender=sid and created_at>now()-interval '1 minute')>500 then raise exception 'Muitos sinais. Tente novamente';end if;
    insert into public.chat_call_signals(request_id,call_id,sender,recipient,payload) values((p_payload->>'requestId')::uuid,callrow.id,sid,target,p_payload->'signal') on conflict(request_id) do nothing;
    return '{}';
   end if;
  end if;
 else raise exception 'Ação inválida';end if;
 if callrow.ended_at is null then
  update public.chat_calls c set ended_at=now() where c.id=callrow.id and c.ended_at is null and (
   not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.state='joined' and m.heartbeat>now()-interval '45 seconds') or
   (not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.employee_number<>c.started_by and m.joined_at is not null) and (c.created_at<now()-interval '60 seconds' or not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.employee_number<>c.started_by and m.state='invited'))));
 end if;
 select to_jsonb(c) into result from public.chat_calls c where c.id=callrow.id;
 return jsonb_build_object('call',result,'ended',result->>'ended_at' is not null,
  'members',(select coalesce(jsonb_agg(jsonb_build_object('employee',m.employee_number,'name',u.display_name,'session',m.session_id,'state',case when m.state='joined' and m.heartbeat<now()-interval '45 seconds' then 'left' else m.state end)),'[]') from public.chat_call_members m join public.authorized_users u using(employee_number) where m.call_id=callrow.id and u.active),
  'signals',case when p_action='poll' then (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select id,sender,payload from public.chat_call_signals where call_id=callrow.id and recipient=sid and id>coalesce((p_payload->>'after')::bigint,0) order by id limit 200) t) else '[]'::jsonb end);
end $$;
revoke all on function public.chat_call(text,jsonb) from public,anon;
grant execute on function public.chat_call(text,jsonb) to authenticated;
