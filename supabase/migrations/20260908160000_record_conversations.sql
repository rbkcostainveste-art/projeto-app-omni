alter table public.internal_conversations add column record_id uuid references public.maintenance_records(id) on delete restrict;
create unique index internal_conversation_record on public.internal_conversations(record_id) where record_id is not null;
alter table public.internal_conversations add constraint chat_one_origin check(post_id is null or record_id is null);
create function private.chat_record_access(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.maintenance_records rec join public.device_identities ident on ident.auth_user_id=auth.uid() join public.authorized_users person using(employee_number)
 where rec.id=rid and person.active and (ident.is_admin or ident.access_profile in('legacy','mechanic','leader_inspector')) and (ident.assigned_base is null or ident.access_profile in('legacy','leader_inspector') or ident.assigned_base=rec.base));
$$;
revoke all on function private.chat_record_access(uuid) from public,anon,authenticated;
create function public.maintenance_chat(p_action text,p_record_id uuid,p_members jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; rec public.maintenance_records; conv public.internal_conversations; result jsonb; new_id uuid; allowed boolean;begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 select * into conv from public.internal_conversations where record_id=p_record_id;
 allowed:=private.chat_record_access(p_record_id);
 if not allowed and not coalesce(private.chat_member(conv.id::text),false) then raise exception 'Registro fora do seu acesso';end if;
 select * into rec from public.maintenance_records where id=p_record_id;
 if rec.id is null then raise exception 'Registro não encontrado';end if;
 if p_action='open' then
  -- One conversation per occurrence, even under simultaneous creation.
  perform 1 from public.maintenance_records where id=p_record_id for update;
  select * into conv from public.internal_conversations where record_id=p_record_id;
  if conv.id is not null then
   if not private.chat_member(conv.id::text) then raise exception 'Peça a um participante para incluir você na conversa desta ocorrência';end if;
   return jsonb_build_object('id',conv.id);
  end if;
  if jsonb_array_length(p_members)=0 then raise exception 'Selecione os participantes';end if;
  new_id:=gen_random_uuid();
  result:=public.internal_chat('create',jsonb_build_object('id',new_id,'members',p_members,'title',rec.prefix||' · '||rec.title||' · '||coalesce(rec.ticket_code,'')));
  update public.internal_conversations set record_id=rec.id where id=new_id;
  return result;
 elsif p_action<>'summary' then raise exception 'Ação inválida';end if;
 return jsonb_build_object('record',jsonb_build_object('id',rec.id,'prefix',rec.prefix,'title',rec.title,'code',rec.ticket_code,'type',rec.record_type),
 'exists',conv.id is not null,'member',coalesce(private.chat_member(conv.id::text),false),
 'conversation',case when private.chat_member(conv.id::text) then (select x from jsonb_array_elements(public.internal_chat('list')) x where x->>'id'=conv.id::text) else null end,
 'links',(select coalesce(jsonb_agg(jsonb_build_object('id',related.id,'prefix',related.prefix,'title',related.title,'code',related.ticket_code,'type',related.record_type)),'[]') from public.maintenance_records related where related.id<>rec.id and private.chat_record_access(related.id) and (coalesce(rec.data->'links','[]') ? related.id::text or coalesce(related.data->'links','[]') ? rec.id::text)));
end $$;
revoke all on function public.maintenance_chat(text,uuid,jsonb) from public,anon;
grant execute on function public.maintenance_chat(text,uuid,jsonb) to authenticated;
