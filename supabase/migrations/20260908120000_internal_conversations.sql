create table public.internal_conversations (
 id uuid primary key, title text not null, post_id text references public.operational_wall_posts(id) on delete set null,
 created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index internal_conversation_activity on public.internal_conversations(post_id) where post_id is not null;
create table public.internal_conversation_members (
 conversation_id uuid not null references public.internal_conversations(id), employee_number text not null,
 added_by text not null, joined_at timestamptz not null default now(), last_read_id bigint not null default 0,
 primary key(conversation_id,employee_number)
);
create index internal_members_person on public.internal_conversation_members(employee_number,conversation_id);
create table public.internal_messages (
 id bigint generated always as identity primary key, request_id uuid not null unique,
 conversation_id uuid not null references public.internal_conversations(id), sender text not null,
 body text not null default '', attachments jsonb not null default '[]', kind text not null default 'message' check(kind in('message','members')),
 created_at timestamptz not null default now()
);
create index internal_messages_page on public.internal_messages(conversation_id,id desc);
alter table public.internal_conversations enable row level security;
alter table public.internal_conversation_members enable row level security;
alter table public.internal_messages enable row level security;
revoke all on public.internal_conversations,public.internal_conversation_members,public.internal_messages from anon,authenticated;

create function private.chat_member(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversation_members m join public.device_identities d using(employee_number) join public.authorized_users u using(employee_number)
 where m.conversation_id::text=cid and d.auth_user_id=auth.uid() and u.active);
$$;
revoke all on function private.chat_member(text) from public,anon;
grant execute on function private.chat_member(text) to authenticated;

-- An invitation is not permission to cross maintenance/base boundaries.
create function private.chat_activity_access(pid text,employee text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.operational_wall_posts p join public.authorized_users u on u.employee_number=employee and u.active
 where p.id=pid and jsonb_array_length(coalesce(p.data->'actions','[]'))>0
 and coalesce(u.job_role,u.access_profile) in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant','leader_inspector')
 and (coalesce(u.job_role,u.access_profile) in('admin','app_manager','maintenance_director','maintenance_manager') or p.base='Todas' or p.base=u.assigned_base));
$$;
revoke all on function private.chat_activity_access(text,text) from public,anon,authenticated;

create function public.internal_chat(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; cid uuid; pid text; c public.internal_conversations; ids text[]; target text; fresh text[]:='{}'; stamp bigint;
 p public.operational_wall_posts; a jsonb; actions jsonb; assigned text[]; result jsonb; media jsonb; req uuid; existing public.internal_messages;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 if p_action='people' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name,'role',coalesce(job_role,access_profile),'base',assigned_base) order by display_name),'[]') from public.authorized_users where active);
 elsif p_action='list' then
  return (select coalesce(jsonb_agg(row_to_json(t) order by t.updated_at desc),'[]') from (
   select c.*, (select count(*) from public.internal_messages x where x.conversation_id=c.id and x.id>m.last_read_id and x.sender<>actor) unread,
    (select string_agg(coalesce(u.display_name,n.employee_number),', ' order by n.joined_at) from public.internal_conversation_members n left join public.authorized_users u using(employee_number) where n.conversation_id=c.id) participants
   from public.internal_conversations c join public.internal_conversation_members m on m.conversation_id=c.id and m.employee_number=actor
  ) t);
 elsif p_action='create' then
  cid:=(p_payload->>'id')::uuid;pid:=nullif(p_payload->>'postId','');
  if cid is null then raise exception 'Identificador obrigatório';end if;
  if exists(select 1 from public.internal_conversations where id=cid) then
   if not private.chat_member(cid::text) then raise exception 'Conversa indisponível';end if;return jsonb_build_object('id',cid);
  end if;
  ids:=array(select distinct jsonb_array_elements_text(coalesce(p_payload->'members','[]')));
  if pid is not null then
   if not private.chat_activity_access(pid,actor) then raise exception 'Atividade fora do seu acesso';end if;
   select * into p from public.operational_wall_posts where id=pid for update;
   select * into c from public.internal_conversations where post_id=pid;
   if c.id is not null then
    if not private.chat_member(c.id::text) then raise exception 'Peça a um participante para incluir você na conversa desta atividade';end if;
    return jsonb_build_object('id',c.id);
   end if;
   ids:=ids||array(select distinct trim(v) from jsonb_array_elements(p.data->'actions') a cross join lateral regexp_split_to_table(coalesce(a->>'assignedTo',''),',') v where private.chat_activity_access(pid,trim(v)));
   if private.chat_activity_access(pid,p.data->>'createdBy') then ids:=array_append(ids,p.data->>'createdBy');end if;
  elsif cardinality(ids)=0 then raise exception 'Selecione pelo menos um participante';end if;
  ids:=array(select distinct unnest(array_append(ids,actor)));
  if cardinality(ids)>50 then raise exception 'Limite de 50 participantes';end if;
  foreach target in array ids loop
   if not exists(select 1 from public.authorized_users where employee_number=target and active) or (pid is not null and not private.chat_activity_access(pid,target)) then raise exception 'Participante sem acesso à atividade ou inativo';end if;
  end loop;
  insert into public.internal_conversations(id,title,post_id,created_by) values(cid,left(coalesce(nullif(trim(p_payload->>'title'),''),case when pid is not null then coalesce(p.data->>'ticketCode','')||' · '||(p.data->>'title') else 'Conversa' end),200),pid,actor);
  foreach target in array ids loop insert into public.internal_conversation_members(conversation_id,employee_number,added_by) values(cid,target,actor);end loop;
  insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor,'Criou a conversa com: '||(select string_agg(coalesce(display_name,employee_number)||' ('||employee_number||')',', ') from public.authorized_users where employee_number=any(ids)),'members');
  return jsonb_build_object('id',cid);
 end if;
 cid:=(p_payload->>'id')::uuid;
 if not private.chat_member(cid::text) then raise exception 'Você não participa desta conversa';end if;
 select * into c from public.internal_conversations where id=cid;
 if p_action='messages' then
  return jsonb_build_object('conversation',to_jsonb(c),'members',(select jsonb_agg(jsonb_build_object('id',m.employee_number,'name',u.display_name,'joinedAt',m.joined_at,'addedBy',m.added_by,'lastReadId',m.last_read_id) order by m.joined_at) from public.internal_conversation_members m left join public.authorized_users u using(employee_number) where m.conversation_id=cid),
   'messages',(select coalesce(jsonb_agg(row_to_json(t) order by t.id),'[]') from (select * from public.internal_messages where conversation_id=cid and (nullif(p_payload->>'before','') is null or id<(p_payload->>'before')::bigint) order by id desc limit 50) t));
 elsif p_action='read' then
  select max(id) into stamp from public.internal_messages where conversation_id=cid and id<=coalesce((p_payload->>'messageId')::bigint,0);
  update public.internal_conversation_members set last_read_id=greatest(last_read_id,coalesce(stamp,0)) where conversation_id=cid and employee_number=actor;
  return '{}';
 elsif p_action='send' then
  req:=(p_payload->>'requestId')::uuid;
  if req is null then raise exception 'Identificador da mensagem obrigatório';end if;
  -- Serialize sends/invitations in each conversation and make retries idempotent.
  perform 1 from public.internal_conversations where id=cid for update;
  select * into existing from public.internal_messages where request_id=req;
  if existing.id is not null then
   if existing.conversation_id<>cid or existing.sender<>actor then raise exception 'Identificador já utilizado';end if;
   return jsonb_build_object('id',existing.id);
  end if;
  media:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(media)<>'array' or jsonb_array_length(media)>10 then raise exception 'Anexos inválidos';end if;
  if length(trim(coalesce(p_payload->>'body','')))>8000 then raise exception 'Limite de 8000 caracteres';end if;
  if trim(coalesce(p_payload->>'body',''))='' and jsonb_array_length(media)=0 then raise exception 'Mensagem vazia';end if;
  if exists(select 1 from jsonb_array_elements(media) x where coalesce(x->>'bucket','')<>'internal-chat' or coalesce(x->>'type','') not in('image','video','audio') or split_part(x->>'url','/',1)<>cid::text or split_part(x->>'url','/',2)<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='internal-chat' and o.name=x->>'url')) then raise exception 'Anexo fora da conversa';end if;
  insert into public.internal_messages(request_id,conversation_id,sender,body,attachments) values(req,cid,actor,trim(coalesce(p_payload->>'body','')),media) returning id into stamp;
  update public.internal_conversations set updated_at=clock_timestamp() where id=cid;
  return jsonb_build_object('id',stamp);
 elsif p_action='invite' then
  -- Lock the activity before the conversation to match activity-open lock order.
  if c.post_id is not null then
   if not private.chat_activity_access(c.post_id,actor) then raise exception 'Atividade fora do seu acesso';end if;
   select * into p from public.operational_wall_posts where id=c.post_id for update;
  end if;
  perform 1 from public.internal_conversations where id=cid for update;
  ids:=array(select distinct jsonb_array_elements_text(coalesce(p_payload->'members','[]')));
  if cardinality(ids)=0 then raise exception 'Selecione participantes';end if;
  if (select count(*) from public.internal_conversation_members where conversation_id=cid)+cardinality(ids)>50 then raise exception 'Limite de 50 participantes';end if;
  foreach target in array ids loop
   if not exists(select 1 from public.authorized_users where employee_number=target and active) or (c.post_id is not null and not private.chat_activity_access(c.post_id,target)) then raise exception 'Participante sem acesso à atividade ou inativo';end if;
   if not exists(select 1 from public.internal_conversation_members where conversation_id=cid and employee_number=target) then
    insert into public.internal_conversation_members(conversation_id,employee_number,added_by) values(cid,target,actor);fresh:=array_append(fresh,target);
   end if;
  end loop;
  if cardinality(fresh)>0 then
   insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor,'Incluiu: '||(select string_agg(coalesce(display_name,employee_number)||' ('||employee_number||')',', ') from public.authorized_users where employee_number=any(fresh)),'members');
   if c.post_id is not null then
    actions:='[]';
    for a in select * from jsonb_array_elements(p.data->'actions') loop
     assigned:=array(select distinct trim(v) from unnest(string_to_array(coalesce(a->>'assignedTo',''),',')||fresh) v where trim(v)<>'');
     actions:=actions||jsonb_build_array(a||jsonb_build_object('assignedTo',array_to_string(assigned,', ')));
    end loop;
    update public.operational_wall_posts set data=data||jsonb_build_object('actions',actions,'history',coalesce(data->'history','[]')||jsonb_build_array(jsonb_build_object('employeeNumber',actor,'at',now(),'event','Incluiu participantes na conversa e nos avisos da atividade: '||array_to_string(fresh,', ')))),revision=revision+1,updated_at=now() where id=c.post_id;
   end if;
   update public.internal_conversations set updated_at=clock_timestamp() where id=cid;
  end if;
  return '{}';
 end if;
 raise exception 'Ação de conversa inválida';
end $$;
revoke all on function public.internal_chat(text,jsonb) from public,anon;
grant execute on function public.internal_chat(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('internal-chat','internal-chat',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/aac']);
create policy "chat members read media" on storage.objects for select to authenticated using(bucket_id='internal-chat' and private.chat_member(split_part(name,'/',1)));
create policy "chat members upload media" on storage.objects for insert to authenticated with check(bucket_id='internal-chat' and split_part(name,'/',2)=auth.uid()::text and private.chat_member(split_part(name,'/',1)));
-- Messages and published attachments are immutable; corrections are new signed messages.

-- Designation is an alert, not exclusive execution rights. Preserve role and base checks.
do $$ declare definition text;begin
 select pg_get_functiondef('public.record_maintenance_task_result(text,text,text,uuid,jsonb)'::regprocedure) into definition;
 definition:=regexp_replace(definition,' if role_name=''mechanic'' and nullif\(a->>''assignedTo''[^\n]+Tarefa atribuída a outro executante[^\n]+','');
 if definition like '%Tarefa atribuída a outro executante%' then raise exception 'Assignment guard not removed';end if;
 execute definition;
end $$;
