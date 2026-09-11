CREATE OR REPLACE FUNCTION public.chat_fixed_group(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.authorized_users; cid uuid; c public.internal_conversations; spec jsonb; rule jsonb; rules jsonb:='[]'; emp text; global_access boolean;
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
 spec:=p_payload->'audience';
 if spec is null or jsonb_typeof(spec->'rules') is distinct from 'array' or jsonb_typeof(spec->'included') is distinct from 'array' or jsonb_typeof(spec->'excluded') is distinct from 'array' or octet_length(spec::text)>250000 then raise exception 'Público inválido';end if;
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
 for rule in select value from jsonb_array_elements(spec->'rules') loop
  if jsonb_typeof(rule)<>'object' or exists(select 1 from jsonb_each(rule) kv where kv.key not in('base','fleet','shift','mission','role','area') or jsonb_typeof(kv.value)<>'string') then raise exception 'Filtro inválido';end if;
  if not global_access and (nullif(actor.assigned_base,'') is null or coalesce(rule->>'base','')<>actor.assigned_base) then raise exception 'Selecione sua base nos filtros';end if;
  rules:=rules||jsonb_build_array(rule);
 end loop;
 for emp in select value from jsonb_array_elements_text(spec->'included') loop
  if not exists(select 1 from public.authorized_users where employee_number=emp and active and (global_access or assigned_base=actor.assigned_base)) then raise exception 'Pessoa adicional fora do seu acesso';end if;
 end loop;
 spec:=jsonb_build_object('rules',rules,'included',spec->'included','excluded',spec->'excluded');
 if not exists(select 1 from public.authorized_users u where private.chat_audience_matches(u,spec)) then raise exception 'Selecione ao menos um participante';end if;
 if p_action='create' then
  insert into public.internal_conversations(id,title,created_by,aircraft_prefix,audience) values(cid,left(coalesce(nullif(trim(p_payload->>'title'),''),'Grupo fixo'),200),actor.employee_number,p_payload->>'aircraftPrefix',spec);
 else
  update public.internal_conversations set audience=spec,updated_at=clock_timestamp() where id=cid;
 end if;
 perform private.sync_chat_audience(cid);
 -- Creator is not silently added: participation follows the configured audience.
 insert into public.internal_messages(request_id,conversation_id,sender,body,kind) values(gen_random_uuid(),cid,actor.employee_number,case when p_action='create' then 'Criou a conversa por público' else 'Atualizou os critérios do público' end,'members');
 return jsonb_build_object('id',cid);
end $function$
;
