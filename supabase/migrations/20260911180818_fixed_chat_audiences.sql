-- Ordinary and task conversations retain their existing membership semantics.
alter table public.internal_conversations add column audience jsonb;
create table public.chat_membership_periods(
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.internal_conversations(id),
 employee_number text not null, start_after bigint not null, end_at bigint,
 joined_at timestamptz not null default clock_timestamp(), left_at timestamptz,
 check(end_at is null or end_at>=start_after)
);
create unique index chat_period_open on public.chat_membership_periods(conversation_id,employee_number) where end_at is null;
create index chat_period_history on public.chat_membership_periods(conversation_id,employee_number,start_after,end_at);
alter table public.chat_membership_periods enable row level security;
revoke all on public.chat_membership_periods from public,anon,authenticated;

create function private.chat_audience_matches(person public.authorized_users, audience jsonb) returns boolean language sql stable set search_path='' as $$
 select person.active and not coalesce(audience->'excluded','[]') ? person.employee_number and
 (coalesce(audience->'included','[]') ? person.employee_number or exists(
 select 1 from jsonb_array_elements(coalesce(audience->'rules','[]')) rule where
 (coalesce(rule->>'base','')='' or rule->>'base'=person.assigned_base) and
 (coalesce(rule->>'fleet','')='' or rule->>'fleet'=any(person.fleets)) and
 (coalesce(rule->>'shift','')='' or rule->>'shift'=person.work_shift) and
 (coalesce(rule->>'mission','')='' or rule->>'mission'=person.mission) and
 (coalesce(rule->>'role','')='' or rule->>'role'=coalesce(person.job_role,person.access_profile)) and
 (coalesce(rule->>'area','')='' or rule->>'area'=case
 when coalesce(person.job_role,person.access_profile) in ('mechanic','maintenance_assistant','leader_inspector') or coalesce(person.job_role,person.access_profile) like 'maintenance_%' then 'maintenance'
 when coalesce(person.job_role,person.access_profile) in ('commander','copilot','flight_attendant') then 'crew'
 when coalesce(person.job_role,person.access_profile) in ('toolroom','coordination','dispatch') then coalesce(person.job_role,person.access_profile) else 'other' end)));
$$;
create function private.chat_current(cid uuid,emp text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversation_members m join public.internal_conversations c on c.id=m.conversation_id join public.authorized_users u on u.employee_number=m.employee_number where c.id=cid and m.employee_number=emp and u.active and (c.audience is null or exists(select 1 from public.chat_membership_periods p where p.conversation_id=cid and p.employee_number=emp and p.end_at is null)));
$$;
create function private.chat_message_visible(cid uuid,mid bigint,emp text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversation_members m join public.internal_conversations c on c.id=m.conversation_id where c.id=cid and m.employee_number=emp and (c.audience is null or exists(select 1 from public.chat_membership_periods p where p.conversation_id=cid and p.employee_number=emp and mid>p.start_after and (p.end_at is null or mid<=p.end_at))));
$$;
create function private.chat_current_user(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select private.chat_current(cid::uuid,d.employee_number) from public.device_identities d where d.auth_user_id=auth.uid()),false);
$$;

create function private.sync_chat_audience(cid uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.internal_conversations; cutoff bigint; desired text[]; emp text;
begin
 select * into c from public.internal_conversations where id=cid for update;
 if c.audience is null then return;end if;
 select coalesce(max(id),0) into cutoff from public.internal_messages where conversation_id=cid;
 select coalesce(array_agg(u.employee_number),'{}') into desired from public.authorized_users u where private.chat_audience_matches(u,c.audience);
 for emp in select employee_number from public.chat_membership_periods where conversation_id=cid and end_at is null and not(employee_number=any(desired)) loop
  update public.chat_membership_periods set end_at=cutoff,left_at=clock_timestamp() where conversation_id=cid and employee_number=emp and end_at is null;
  update public.chat_call_members m set state='left',left_at=clock_timestamp() from public.chat_calls call where m.call_id=call.id and call.conversation_id=cid and m.employee_number=emp and m.state in('joined','invited');
  delete from public.chat_call_signals s using public.chat_calls call where s.call_id=call.id and call.conversation_id=cid;
  update public.chat_push_jobs j set done=true from public.internal_messages msg where j.message_id=msg.id and msg.conversation_id=cid and j.employee_number=emp and not j.done;
  insert into public.chat_inbox_updates(employee_number) values(emp) on conflict(employee_number) do update set revision=public.chat_inbox_updates.revision+1,updated_at=clock_timestamp();
 end loop;
 foreach emp in array desired loop
  if not exists(select 1 from public.chat_membership_periods where conversation_id=cid and employee_number=emp and end_at is null) then
   insert into public.internal_conversation_members(conversation_id,employee_number,added_by,last_read_id) values(cid,emp,c.created_by,cutoff) on conflict(conversation_id,employee_number) do nothing;
   insert into public.chat_membership_periods(conversation_id,employee_number,start_after) values(cid,emp,cutoff);
   insert into public.chat_inbox_updates(employee_number) values(emp) on conflict(employee_number) do update set revision=public.chat_inbox_updates.revision+1,updated_at=clock_timestamp();
  end if;
 end loop;
end $$;
create function private.sync_person_chat_audiences() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 for cid in select id from public.internal_conversations where audience is not null order by id loop perform private.sync_chat_audience(cid);end loop;
 return new;
end $$;
create trigger sync_person_chat_audiences after insert or update of active,assigned_base,fleets,work_shift,mission,job_role,access_profile on public.authorized_users for each row execute function private.sync_person_chat_audiences();

create function public.chat_fixed_group(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.authorized_users; cid uuid; c public.internal_conversations; audience jsonb; rule jsonb; rules jsonb:='[]'; emp text; global_access boolean;
begin
 select u.* into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor.employee_number is null then raise exception 'Identificação necessária';end if;
 global_access:=coalesce(actor.job_role,actor.access_profile) in('admin','app_manager','maintenance_director','maintenance_manager');
 cid:=(p_payload->>'id')::uuid;
 if p_action='get' then
  select * into c from public.internal_conversations where id=cid;
  if c.audience is null or (c.created_by<>actor.employee_number and not global_access) then raise exception 'Somente o criador ou gestão global pode configurar este público';end if;
  return c.audience;
 end if;
 if p_action not in('create','update') then raise exception 'Operação inválida';end if;
 if coalesce(actor.job_role,actor.access_profile) not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','coordination','leader_inspector') then raise exception 'Somente liderança pode configurar grupos fixos';end if;
 audience:=p_payload->'audience';
 if audience is null or jsonb_typeof(audience->'rules') is distinct from 'array' or jsonb_typeof(audience->'included') is distinct from 'array' or jsonb_typeof(audience->'excluded') is distinct from 'array' or octet_length(audience::text)>250000 then raise exception 'Público inválido';end if;
 if p_action='update' then
  select * into c from public.internal_conversations where id=cid for update;
  if c.audience is null or c.post_id is not null or c.record_id is not null or (c.created_by<>actor.employee_number and not global_access) then raise exception 'Este grupo não pode ser alterado';end if;
 else
  if exists(select 1 from public.internal_conversations where id=cid) then
   select * into c from public.internal_conversations where id=cid;
   if c.created_by=actor.employee_number and c.audience is not null then return jsonb_build_object('id',cid);end if;
   raise exception 'Identificador já utilizado';
  end if;
 end if;
 for rule in select value from jsonb_array_elements(audience->'rules') loop
  if jsonb_typeof(rule)<>'object' or exists(select 1 from jsonb_each(rule) kv where kv.key not in('base','fleet','shift','mission','role','area') or jsonb_typeof(kv.value)<>'string') then raise exception 'Filtro inválido';end if;
  if not global_access and (nullif(actor.assigned_base,'') is null or coalesce(rule->>'base','')<>actor.assigned_base) then raise exception 'Selecione sua base nos filtros';end if;
  rules:=rules||jsonb_build_array(rule);
 end loop;
 for emp in select value from jsonb_array_elements_text(audience->'included') loop
  if not exists(select 1 from public.authorized_users where employee_number=emp and active and (global_access or assigned_base=actor.assigned_base)) then raise exception 'Pessoa adicional fora do seu acesso';end if;
 end loop;
 audience:=jsonb_build_object('rules',rules,'included',audience->'included','excluded',audience->'excluded');
 if not exists(select 1 from public.authorized_users u where private.chat_audience_matches(u,audience)) then raise exception 'Selecione ao menos um participante';end if;
 if p_action='create' then
  insert into public.internal_conversations(id,title,created_by,aircraft_prefix,audience) values(cid,left(coalesce(nullif(trim(p_payload->>'title'),''),'Grupo fixo'),200),actor.employee_number,p_payload->>'aircraftPrefix',audience);
 else
  update public.internal_conversations set audience=chat_fixed_group.audience,updated_at=clock_timestamp() where id=cid;
 end if;
 perform private.sync_chat_audience(cid);
 -- Creator is not silently added: participation follows the configured audience.
 insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor.employee_number,case when p_action='create' then 'Criou a conversa por público' else 'Atualizou os critérios do público' end,'members');
 return jsonb_build_object('id',cid);
end $$;

-- Ordinary media keeps its existing policy; fixed groups check the message period.
create function private.chat_media_visible(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversations c join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u on u.employee_number=d.employee_number and u.active where c.id::text=split_part(path,'/',1) and private.chat_member(c.id::text) and
 (c.audience is null or (private.chat_current(c.id,d.employee_number) and split_part(path,'/',2)=auth.uid()::text) or exists(select 1 from public.internal_messages msg,jsonb_array_elements(msg.attachments) a where msg.conversation_id=c.id and a->>'url'=path and private.chat_message_visible(c.id,msg.id,d.employee_number))));
$$;
drop policy "chat members read media" on storage.objects;
create policy "chat members read media" on storage.objects for select to authenticated using(bucket_id='internal-chat' and private.chat_media_visible(name));
drop policy "chat members upload media" on storage.objects;
create policy "chat members upload media" on storage.objects for insert to authenticated with check(bucket_id='internal-chat' and private.chat_current_user(split_part(name,'/',1)) and split_part(name,'/',2)=auth.uid()::text);

revoke all on function public.chat_fixed_group(text,jsonb) from public,anon;
grant execute on function public.chat_fixed_group(text,jsonb) to authenticated;
revoke all on function private.chat_audience_matches(public.authorized_users,jsonb),private.chat_current(uuid,text),private.chat_message_visible(uuid,bigint,text),private.chat_current_user(text),private.sync_chat_audience(uuid),private.sync_person_chat_audiences(),private.chat_media_visible(text) from public,anon,authenticated;
grant execute on function private.chat_current_user(text),private.chat_media_visible(text) to authenticated;
CREATE OR REPLACE FUNCTION public.internal_chat(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor text; cid uuid; pid text; c public.internal_conversations; ids text[]; target text; fresh text[]:='{}'; stamp bigint;
 p public.operational_wall_posts; a jsonb; actions jsonb; assigned text[]; result jsonb; media jsonb; req uuid; existing public.internal_messages;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 if p_action='people' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name,'role',coalesce(job_role,access_profile),'base',assigned_base,'fleets',coalesce(fleets,'{}'::text[]),'mission',mission,'workShift',work_shift) order by display_name),'[]') from public.authorized_users where active);

 elsif p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(inbox)||jsonb_build_object('updated_at',coalesce(inbox.last_visible_at,inbox.created_at)) order by coalesce(inbox.last_visible_at,inbox.created_at) desc),'[]') from (
   select conv.*, (select max(msg.created_at) from public.internal_messages msg where msg.conversation_id=conv.id and private.chat_message_visible(conv.id,msg.id,actor) and private.chat_message_visible(conv.id,msg.id,actor)) last_visible_at, (select record_type from public.maintenance_records where id=conv.record_id) record_type,
    (select count(*) from public.internal_messages msg where msg.conversation_id=conv.id and private.chat_message_visible(conv.id,msg.id,actor) and msg.id>membership.last_read_id and msg.sender<>actor) unread,
    (select count(*) from public.internal_messages msg where msg.conversation_id=conv.id and private.chat_message_visible(conv.id,msg.id,actor) and msg.kind='message') message_count,
    (select coalesce(nullif(msg.body,''),'📎 Anexo') from public.internal_messages msg where msg.conversation_id=conv.id and private.chat_message_visible(conv.id,msg.id,actor) order by msg.id desc limit 1) last_message,
    (select jsonb_agg(jsonb_build_object('id',member.employee_number,'name',coalesce(person.display_name,member.employee_number)) order by member.joined_at,member.employee_number) from public.internal_conversation_members member left join public.authorized_users person using(employee_number) where member.conversation_id=conv.id) members,
    (select string_agg(coalesce(person.display_name,member.employee_number),', ' order by member.joined_at) from public.internal_conversation_members member left join public.authorized_users person using(employee_number) where member.conversation_id=conv.id) participants
   from public.internal_conversations conv join public.internal_conversation_members membership on membership.conversation_id=conv.id and membership.employee_number=actor
  ) inbox);
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
   ids:=ids||array(select distinct trim(v) from jsonb_array_elements(p.data->'actions') activity cross join lateral regexp_split_to_table(coalesce(activity->>'assignedTo',''),',') v where private.chat_activity_access(pid,trim(v)));
   if private.chat_activity_access(pid,p.data->>'createdBy') then ids:=array_append(ids,p.data->>'createdBy');end if;
  elsif cardinality(ids)=0 then raise exception 'Selecione pelo menos um participante';end if;
  ids:=array(select distinct unnest(array_append(ids,actor)));
  
  foreach target in array ids loop
   if not exists(select 1 from public.authorized_users where employee_number=target and active) then raise exception 'Participante inativo ou não encontrado';end if;
  end loop;
  insert into public.internal_conversations(id,title,post_id,created_by,aircraft_prefix) values(cid,left(coalesce(nullif(trim(p_payload->>'title'),''),case when pid is not null then coalesce(p.data->>'ticketCode','')||' · '||(p.data->>'title') else 'Conversa' end),200),pid,actor,p_payload->>'aircraftPrefix');
  foreach target in array ids loop insert into public.internal_conversation_members(conversation_id,employee_number,added_by) values(cid,target,actor);end loop;
  insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor,'Criou a conversa com: '||(select string_agg(coalesce(display_name,employee_number)||' ('||employee_number||')',', ') from public.authorized_users where employee_number=any(ids)),'members');
  return jsonb_build_object('id',cid);
 end if;
 cid:=(p_payload->>'id')::uuid;
 if not private.chat_member(cid::text) then raise exception 'Você não participa desta conversa';end if;
 select * into c from public.internal_conversations where id=cid;
 if p_action in('send','invite') then
  perform 1 from public.internal_conversations where id=cid for update;
  if not private.chat_current(cid,actor) then raise exception 'Você está consultando somente seu histórico de participação';end if;
  if p_action='invite' and c.audience is not null then raise exception 'Use configurar público para alterar um grupo fixo';end if;
 end if;
 if p_action='messages' then
  return jsonb_build_object('conversation',to_jsonb(c)||jsonb_build_object('is_current',private.chat_current(cid,actor)),'members',(select jsonb_agg(jsonb_build_object('id',m.employee_number,'name',u.display_name,'joinedAt',m.joined_at,'addedBy',m.added_by,'lastReadId',m.last_read_id) order by m.joined_at) from public.internal_conversation_members m left join public.authorized_users u using(employee_number) where m.conversation_id=cid),
   'messages',(select coalesce(jsonb_agg(row_to_json(t) order by t.id),'[]') from (select * from public.internal_messages where conversation_id=cid and private.chat_message_visible(cid,id,actor) and (nullif(p_payload->>'before','') is null or id<(p_payload->>'before')::bigint) order by id desc limit 50) t));
 elsif p_action='read' then
  select max(id) into stamp from public.internal_messages where conversation_id=cid and private.chat_message_visible(cid,id,actor) and id<=coalesce((p_payload->>'messageId')::bigint,0);
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
  if exists(select 1 from jsonb_array_elements(media) x where coalesce(x->>'bucket','')<>'internal-chat' or coalesce(x->>'type','') not in('image','video','audio','document') or split_part(x->>'url','/',1)<>cid::text or split_part(x->>'url','/',2)<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='internal-chat' and o.name=x->>'url')) then raise exception 'Anexo fora da conversa';end if;
  insert into public.internal_messages(request_id,conversation_id,sender,body,attachments) values(req,cid,actor,trim(coalesce(p_payload->>'body','')),media) returning id into stamp;
  update public.internal_conversations set updated_at=clock_timestamp() where id=cid;
  return jsonb_build_object('id',stamp);
 elsif p_action='invite' then
  -- Lock the activity before the conversation to match activity-open lock order.
  if c.post_id is not null then
   
   select * into p from public.operational_wall_posts where id=c.post_id for update;
  end if;
  perform 1 from public.internal_conversations where id=cid for update;
  ids:=array(select distinct jsonb_array_elements_text(coalesce(p_payload->'members','[]')));
  if cardinality(ids)=0 then raise exception 'Selecione participantes';end if;
  
  foreach target in array ids loop
   if not exists(select 1 from public.authorized_users where employee_number=target and active) then raise exception 'Participante inativo ou não encontrado';end if;
   if not exists(select 1 from public.internal_conversation_members where conversation_id=cid and employee_number=target) then
    insert into public.internal_conversation_members(conversation_id,employee_number,added_by) values(cid,target,actor);fresh:=array_append(fresh,target);
   end if;
  end loop;
  if cardinality(fresh)>0 then
   insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor,'Incluiu: '||(select string_agg(coalesce(display_name,employee_number)||' ('||employee_number||')',', ') from public.authorized_users where employee_number=any(fresh)),'members');
   if c.post_id is not null then
    actions:='[]';
    for a in select * from jsonb_array_elements(p.data->'actions') loop
     assigned:=array(select distinct trim(v) from unnest(string_to_array(coalesce(a->>'assignedTo',''),',')||array(select person from unnest(fresh) person where private.chat_activity_access(c.post_id,person))) v where trim(v)<>'');
     actions:=actions||jsonb_build_array(a||jsonb_build_object('assignedTo',array_to_string(assigned,', ')));
    end loop;
    update public.operational_wall_posts set data=data||jsonb_build_object('actions',actions,'history',coalesce(data->'history','[]')||jsonb_build_array(jsonb_build_object('employeeNumber',actor,'at',now(),'event','Incluiu participantes na conversa (avisos conforme acesso à atividade): '||array_to_string(fresh,', ')))),revision=revision+1,updated_at=now() where id=c.post_id;
   end if;
   update public.internal_conversations set updated_at=clock_timestamp() where id=cid;
  end if;
  return '{}';
 end if;
 raise exception 'Ação de conversa inválida';
end $function$
;

CREATE OR REPLACE FUNCTION public.chat_call(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   where c.ended_at is null and m.state='invited' and private.chat_current_user(c.conversation_id::text)
   and c.created_at>now()-interval '60 seconds'
   and exists(select 1 from public.chat_call_members x where x.call_id=c.id and x.state='joined' and x.heartbeat>now()-interval '45 seconds')
   order by c.created_at desc limit 10) t);
 end if;
 sid:=(p_payload->>'session')::uuid;
 if p_action='start' then
  cid:=(p_payload->>'conversation')::uuid;
  if not private.chat_current_user(cid::text) then raise exception 'Você não participa desta conversa';end if;
  perform pg_advisory_xact_lock(hashtextextended('chat-call:'||actor,0));
  perform 1 from public.internal_conversations where id=cid for update;
  update public.chat_calls c set ended_at=now() where c.conversation_id=cid and c.ended_at is null and not exists(select 1 from public.chat_call_members m where m.call_id=c.id and m.state='joined' and m.heartbeat>now()-interval '45 seconds');
  select * into callrow from public.chat_calls where conversation_id=cid and ended_at is null;
  if callrow.id is null then
   if sid is null or coalesce(p_payload->>'mode','') not in('audio','video') then raise exception 'Chamada inválida';end if;
   if exists(select 1 from public.chat_call_members m join public.chat_calls c on c.id=m.call_id where m.employee_number=actor and m.state='joined' and m.heartbeat>now()-interval '45 seconds' and c.ended_at is null) then raise exception 'Você já está em outra chamada';end if;
   insert into public.chat_calls(id,conversation_id,started_by,mode) values((p_payload->>'id')::uuid,cid,actor,p_payload->>'mode') returning * into callrow;
   insert into public.chat_call_members(call_id,employee_number) select callrow.id,m.employee_number from public.internal_conversation_members m join public.authorized_users u using(employee_number) where m.conversation_id=cid and u.active and private.chat_current(cid,m.employee_number);
   perform public.internal_chat('send',jsonb_build_object('id',cid,'requestId',gen_random_uuid(),'body','Chamada de '||case when callrow.mode='video' then 'vídeo' else 'voz' end||' no aplicativo. Abra a conversa para atender.'));
  end if;
 else
  select * into callrow from public.chat_calls where id=(p_payload->>'id')::uuid;
  if callrow.id is null or not private.chat_current_user(callrow.conversation_id::text) then raise exception 'Chamada indisponível';end if;
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
  if callrow.ended_at is not null then return jsonb_build_object('ended',true);end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.chat_receipt(p_action text, p_conversation uuid, p_ids bigint[] DEFAULT '{}'::bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor text;begin
 if not private.chat_member(p_conversation::text) then raise exception 'Você não participa desta conversa';end if;
 select employee_number into actor from public.device_identities where auth_user_id=auth.uid();
 if p_action in('delivered','read','ack') then
  insert into public.chat_receipts(message_id,employee_number) select msg.id,actor from public.internal_messages msg where msg.conversation_id=p_conversation and private.chat_message_visible(p_conversation,msg.id,actor) and msg.id=any(p_ids) and msg.sender<>actor on conflict do nothing;
  update public.chat_receipts receipt set delivered_at=coalesce(receipt.delivered_at,clock_timestamp()),read_at=case when p_action in('read','ack') then coalesce(receipt.read_at,clock_timestamp()) else receipt.read_at end,acknowledged_at=case when p_action='ack' then coalesce(receipt.acknowledged_at,clock_timestamp()) else receipt.acknowledged_at end
  from public.internal_messages msg where receipt.message_id=msg.id and msg.conversation_id=p_conversation and private.chat_message_visible(p_conversation,msg.id,actor) and receipt.employee_number=actor and msg.id=any(p_ids);
 elsif p_action<>'list' then raise exception 'Ação inválida';end if;
 return (select coalesce(jsonb_agg(to_jsonb(receipt)),'[]') from public.chat_receipts receipt join public.internal_messages msg on msg.id=receipt.message_id where msg.conversation_id=p_conversation and private.chat_message_visible(p_conversation,msg.id,actor) and (cardinality(p_ids)=0 or msg.id=any(p_ids)));
end $function$
;

CREATE OR REPLACE FUNCTION private.enqueue_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 insert into public.chat_receipts(message_id,employee_number) select new.id,m.employee_number from public.internal_conversation_members m where m.conversation_id=new.conversation_id and m.employee_number<>new.sender and private.chat_current(new.conversation_id,m.employee_number);
 if new.kind='message' then
 insert into public.chat_push_jobs(message_id,employee_number) select message_id,employee_number from public.chat_receipts where message_id=new.id;
 perform net.http_post(url:='https://ecdhhfyobalpswojaklv.supabase.co/functions/v1/send-chat-notifications',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='push_cron_secret')),body:='{}'::jsonb);
 end if;return new;end $function$
;

CREATE OR REPLACE FUNCTION private.notify_chat_inbox()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 insert into public.chat_inbox_updates(employee_number) select employee_number from public.internal_conversation_members where conversation_id=new.conversation_id and private.chat_current(new.conversation_id,employee_number)
 on conflict(employee_number) do update set revision=public.chat_inbox_updates.revision+1,updated_at=clock_timestamp();
 return new;end $function$
;

CREATE OR REPLACE FUNCTION public.claim_chat_push()
 RETURNS SETOF chat_push_jobs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 update public.chat_push_jobs set attempts=attempts+1,available_at=now()+interval '2 minutes' where (message_id,employee_number) in(select message_id,employee_number from public.chat_push_jobs where exists(select 1 from public.internal_messages msg where msg.id=chat_push_jobs.message_id and private.chat_current(msg.conversation_id,chat_push_jobs.employee_number)) and not done and attempts<5 and available_at<=now() order by available_at for update skip locked limit 50) returning *;
$function$
;
