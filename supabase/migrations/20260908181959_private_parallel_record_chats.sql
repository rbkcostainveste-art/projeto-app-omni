drop index if exists public.internal_conversation_record;
create index internal_conversation_record on public.internal_conversations(record_id) where record_id is not null;
create or replace function public.maintenance_chat(p_action text,p_record_id uuid,p_members jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; rec public.maintenance_records; conv public.internal_conversations; chats jsonb; result jsonb; new_id uuid; members jsonb;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 if not private.chat_record_access(p_record_id) and not exists(select 1 from public.internal_conversations c join public.internal_conversation_members m on m.conversation_id=c.id where c.record_id=p_record_id and m.employee_number=actor) then raise exception 'Registro fora do seu acesso';end if;
 select * into rec from public.maintenance_records where id=p_record_id;
 if rec.id is null then raise exception 'Registro não encontrado';end if;
 select coalesce(jsonb_agg(x),'[]') into chats from jsonb_array_elements(public.internal_chat('list')) x where x->>'record_id'=p_record_id::text;
 if p_action in ('open','create') then
  -- Older clients may open an existing member conversation. New creation is explicit.
  if p_action='open' and jsonb_array_length(chats)>0 then return jsonb_build_object('id',chats->0->>'id');end if;
  if jsonb_typeof(p_members)='object' then
   new_id:=(p_members->>'requestId')::uuid;members:=p_members->'members';
   if new_id is null then raise exception 'Identificador obrigatório';end if;
  else new_id:=gen_random_uuid();members:=p_members;end if;
  if jsonb_typeof(members) is distinct from 'array' or jsonb_array_length(members)=0 then raise exception 'Selecione os participantes';end if;
  perform 1 from public.maintenance_records where id=p_record_id for update;
  select * into conv from public.internal_conversations where id=new_id;
  if conv.id is not null then
   if conv.created_by<>actor or conv.record_id is distinct from p_record_id or not private.chat_member(conv.id::text) then raise exception 'Identificador indisponível';end if;
   return jsonb_build_object('id',conv.id);
  end if;
  result:=public.internal_chat('create',jsonb_build_object('id',new_id,'members',members,'title',rec.prefix||' · '||rec.title||' · '||coalesce(rec.ticket_code,'')));
  update public.internal_conversations set record_id=rec.id where id=new_id;
  return result;
 elsif p_action<>'summary' then raise exception 'Ação inválida';end if;
 return jsonb_build_object('record',jsonb_build_object('id',rec.id,'prefix',rec.prefix,'title',rec.title,'code',rec.ticket_code,'type',rec.record_type),
 'exists',jsonb_array_length(chats)>0,'member',jsonb_array_length(chats)>0,'conversation',chats->0,'conversations',chats,
 'links',(select coalesce(jsonb_agg(jsonb_build_object('id',related.id,'prefix',related.prefix,'title',related.title,'code',related.ticket_code,'type',related.record_type)),'[]') from public.maintenance_records related where related.id<>rec.id and private.chat_record_access(related.id) and (coalesce(rec.data->'links','[]') ? related.id::text or coalesce(related.data->'links','[]') ? rec.id::text)));
end $$;
revoke all on function public.maintenance_chat(text,uuid,jsonb) from public,anon;
grant execute on function public.maintenance_chat(text,uuid,jsonb) to authenticated;
