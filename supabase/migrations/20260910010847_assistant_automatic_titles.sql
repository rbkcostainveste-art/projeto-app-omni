begin;
alter table public.personal_assistant_conversations add column auto_title boolean not null default false;
create or replace function public.personal_assistant(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; cid uuid; result jsonb; c public.personal_assistant_conversations; saved public.personal_assistant_history;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null or actor is distinct from p_payload->>'employee' then raise exception 'Entre novamente para abrir seu assistente';end if;
 if p_action='access' then return '[]'::jsonb;end if;
 if p_action='conversations' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]') from
   (select * from public.personal_assistant_conversations where employee_number=actor
    and (nullif(p_payload->>'beforeCreated','') is null or (created_at,id)<((p_payload->>'beforeCreated')::timestamptz,(p_payload->>'beforeId')::uuid))
    order by created_at desc,id desc limit 50)t);
 end if;
 if p_action='create_conversation' then
  cid:=(p_payload->>'id')::uuid;
  if cid is null or length(trim(coalesce(p_payload->>'title','')))=0 or length(p_payload->>'title')>120 then raise exception 'Título inválido';end if;
  if coalesce(p_payload->>'contextKind','general') not in('general','maintenance-draft') or length(coalesce(p_payload->>'contextId',''))>100 or length(coalesce(p_payload->>'contextLabel',''))>180 then raise exception 'Contexto inválido';end if;
  insert into public.personal_assistant_conversations(id,employee_number,title,context_kind,context_id,context_label,auto_title)
   values(cid,actor,trim(p_payload->>'title'),coalesce(p_payload->>'contextKind','general'),nullif(p_payload->>'contextId',''),nullif(p_payload->>'contextLabel',''),coalesce((p_payload->>'autoTitle')::boolean,false)) on conflict(id) do nothing;
  select * into c from public.personal_assistant_conversations where id=cid and employee_number=actor for update;
  if c.id is null then raise exception 'Conversa indisponível';end if;
  return to_jsonb(c);
 end if;
 cid:=nullif(p_payload->>'conversationId','')::uuid;
 -- Compatibility for the previously published client: only its legacy conversation.
 if cid is null then
  select id into cid from public.personal_assistant_conversations where employee_number=actor and legacy;
  if cid is null and p_action='list' then return '[]'::jsonb;end if;
  if cid is null and p_action='append' then
   insert into public.personal_assistant_conversations(employee_number,title,legacy) values(actor,'Conversa anterior',true)
    on conflict(employee_number) where legacy do update set legacy=true returning id into cid;
  end if;
 end if;
 select * into c from public.personal_assistant_conversations where id=cid and employee_number=actor for update;
 if c.id is null then raise exception 'Conversa indisponível';end if;
 if p_action='rename_conversation' then
  if length(trim(coalesce(p_payload->>'title','')))=0 or length(p_payload->>'title')>120 then raise exception 'Título inválido';end if;
  update public.personal_assistant_conversations set title=trim(p_payload->>'title'),auto_title=false where id=cid and employee_number=actor returning * into c;
  return to_jsonb(c);
 end if;
 if p_action='append' then
  if length(coalesce(p_payload->>'message',''))>8000 or length(coalesce(p_payload->>'reply',''))>32000 or trim(coalesce(p_payload->>'reply',''))='' then raise exception 'Mensagem inválida';end if;
  insert into public.personal_assistant_history(employee_number,conversation_id,request_id,message,reply)
   values(actor,cid,(p_payload->>'requestId')::uuid,coalesce(p_payload->>'message',''),p_payload->>'reply') on conflict(employee_number,request_id) do nothing;
  select * into saved from public.personal_assistant_history where employee_number=actor and request_id=(p_payload->>'requestId')::uuid;
  if saved.conversation_id is distinct from cid then raise exception 'Resposta pertence a outra conversa';end if;
  update public.personal_assistant_conversations set updated_at=greatest(updated_at,saved.created_at),
   title=case when auto_title then left(coalesce(nullif(trim(regexp_replace(saved.message,'[[:space:]]+',' ','g')),''),nullif(context_label,''),'Consulta com imagem'),72) else title end,
   auto_title=false where id=cid;
  return to_jsonb(saved);
 elsif p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select * from public.personal_assistant_history where employee_number=actor and conversation_id=cid and (nullif(p_payload->>'before','') is null or id<(p_payload->>'before')::bigint) order by id desc limit 50)t);
 end if;
 raise exception 'Ação inválida';
end $$;
revoke all on function public.personal_assistant(text,jsonb) from public,anon;
grant execute on function public.personal_assistant(text,jsonb) to authenticated;
commit;
