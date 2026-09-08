create or replace function public.personal_note(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=private.note_actor(); n public.personal_notes; nid uuid; media jsonb; reminder timestamptz; a record; d public.device_identities; kind text; priority text; recdata jsonb; rid uuid;
begin
 if actor is null or actor is distinct from p_payload->>'employee' then raise exception 'Entre novamente para abrir suas notas';end if;
 if p_action='agenda' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.remind_at,t.id),'[]') from (
   select * from public.personal_notes where employee_number=actor and remind_at>=now()
   and (coalesce(p_payload->>'search','')='' or strpos(lower(replace(title||' '||body||' '||prefix,'-','')),lower(replace(p_payload->>'search','-','')))>0)
   and (nullif(p_payload->>'before','') is null or (remind_at,id)>((p_payload->>'before')::timestamptz,(p_payload->>'beforeId')::uuid))
   order by remind_at,id limit 50)t);
 end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id desc),'[]') from (select * from public.personal_notes where employee_number=actor and (coalesce(p_payload->>'search','')='' or strpos(lower(replace(title||' '||body||' '||prefix,'-','')),lower(replace(p_payload->>'search','-','')))>0) and (nullif(p_payload->>'before','') is null or (updated_at,id)<((p_payload->>'before')::timestamptz,(p_payload->>'beforeId')::uuid)) order by updated_at desc,id desc limit 50)t);
 end if;
 nid:=(p_payload->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(nid::text,0));
 select * into n from public.personal_notes where id=nid for update;
 if n.id is not null and n.employee_number<>actor then raise exception 'Nota não encontrada';end if;
 if p_action='save' then
  p_payload:=jsonb_set(p_payload,'{prefix}',to_jsonb(upper(trim(coalesce(p_payload->>'prefix','')))));
  if n.id is not null and coalesce((p_payload->>'revision')::int,0)=0 then return to_jsonb(n);end if;
  if n.id is not null and n.revision<>(p_payload->>'revision')::int then raise exception 'A nota foi alterada em outro aparelho. Reabra antes de salvar';end if;
  if trim(coalesce(p_payload->>'title',''))='' or length(p_payload->>'title')>160 or length(coalesce(p_payload->>'body',''))>16000 then raise exception 'Informe título de até 160 caracteres e texto de até 16000';end if;
  if coalesce(p_payload->>'prefix','')<>'' and not exists(select 1 from public.shared_app_state state cross join lateral jsonb_array_elements(coalesce(state.catalogs->'aircraft','[]')) plane where state.id='main' and upper(trim(plane->>'prefix'))=p_payload->>'prefix') then raise exception 'Selecione uma aeronave cadastrada';end if;
  media:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(media)<>'array' or jsonb_array_length(media)>10 then raise exception 'Limite de 10 imagens ou vídeos';end if;
  if exists(select 1 from jsonb_array_elements(media)m where m->>'type' not in('image','video') or m->>'bucket' is distinct from 'personal-notes' or split_part(m->>'url','/',1) is distinct from actor or split_part(m->>'url','/',2) is distinct from nid::text or not exists(select 1 from storage.objects o where o.bucket_id='personal-notes' and o.name=m->>'url')) then raise exception 'Anexo inválido';end if;
  reminder:=nullif(p_payload->>'remindAt','')::timestamptz;
  if reminder is distinct from n.remind_at and reminder<now() then raise exception 'Escolha data e horário futuros';end if;
  insert into public.personal_notes(id,employee_number,title,body,prefix,attachments,remind_at,reminder_available_at,notify) values(nid,actor,trim(p_payload->>'title'),coalesce(p_payload->>'body',''),coalesce(p_payload->>'prefix',''),media,reminder,reminder,coalesce((p_payload->>'notify')::boolean,false))
  on conflict(id) do update set title=excluded.title,body=excluded.body,prefix=excluded.prefix,attachments=excluded.attachments,updated_at=clock_timestamp(),revision=personal_notes.revision+1,remind_at=excluded.remind_at,notify=excluded.notify,
   reminder_version=personal_notes.reminder_version+case when (personal_notes.remind_at is distinct from excluded.remind_at or personal_notes.notify is distinct from excluded.notify) then 1 else 0 end,
   reminder_done=case when (personal_notes.remind_at is distinct from excluded.remind_at or personal_notes.notify is distinct from excluded.notify) then false else personal_notes.reminder_done end,
   reminder_attempts=case when (personal_notes.remind_at is distinct from excluded.remind_at or personal_notes.notify is distinct from excluded.notify) then 0 else personal_notes.reminder_attempts end,
   reminder_status=case when (personal_notes.remind_at is distinct from excluded.remind_at or personal_notes.notify is distinct from excluded.notify) then null else personal_notes.reminder_status end,
   reminder_available_at=case when (personal_notes.remind_at is distinct from excluded.remind_at or personal_notes.notify is distinct from excluded.notify) then excluded.remind_at else personal_notes.reminder_available_at end returning * into n;
  return to_jsonb(n);
 end if;
 if n.id is null then raise exception 'Nota não encontrada';end if;
 if p_action='get' then return to_jsonb(n);
 elsif p_action='delete' then delete from public.personal_notes where id=n.id;return to_jsonb(n);
 elsif p_action='convert' then
  if n.record_id is not null then return jsonb_build_object('id',n.record_id,'type',n.record_type);end if;
  select * into d from public.device_identities where auth_user_id=auth.uid();
  if not(d.is_admin or d.access_profile in('legacy','mechanic','leader_inspector')) then raise exception 'Seu perfil não permite criar registros de manutenção';end if;
  kind:=p_payload->>'type';priority:=p_payload->>'priority';
  if kind not in('fault','discrepancy') or kind is null or priority is null or (kind='fault' and priority not in('logged','not_logged')) or (kind='discrepancy' and priority not in('routine','urgent')) then raise exception 'Informe o tipo e a classificação';end if;
  select upper(trim(plane->>'prefix')) prefix,plane->>'model' model,plane->>'base' base into a from public.shared_app_state state cross join lateral jsonb_array_elements(coalesce(state.catalogs->'aircraft','[]')) plane where state.id='main' and upper(trim(plane->>'prefix'))=upper(trim(p_payload->>'prefix'));
  if a.prefix is null then raise exception 'Selecione uma aeronave cadastrada com base';end if;
  if trim(coalesce(p_payload->>'title',''))='' or trim(coalesce(p_payload->>'body',''))='' or length(p_payload->>'title')>160 or length(p_payload->>'body')>16000 then raise exception 'Revise título e descrição';end if;
  media:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(media)<>'array' or jsonb_array_length(media)<>jsonb_array_length(n.attachments) then raise exception 'Copie os anexos antes de criar o registro';end if;
  if exists(select 1 from jsonb_array_elements(media)m where m->>'bucket' is distinct from 'record-media' or split_part(m->>'url','/',1) is distinct from 'maintenance' or split_part(m->>'url','/',2) is distinct from nid::text or split_part(m->>'url','/',3) is distinct from auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='record-media' and o.name=m->>'url')) then raise exception 'Cópia de anexo inválida';end if;
  recdata:=jsonb_build_object('id',nid,'recordType',kind,'prefix',a.prefix,'base',a.base,'model',a.model,'title',trim(p_payload->>'title'),'description',trim(p_payload->>'body'),'priority',priority,'status','open','tc',coalesce(p_payload->>'tc',''),'originShift',coalesce(d.work_shift,'day'),'originMission',coalesce(d.mission,''),'createdBy',actor,'createdAt',now(),'updatedAt',now(),'revision',1,'attachments',media,'assignedTo','[]'::jsonb,'links','[]'::jsonb,'entries','[]'::jsonb);
  insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data) values(nid,kind,a.base,a.model,a.prefix,priority,'open',trim(p_payload->>'title'),nullif(p_payload->>'tc',''),actor,recdata) returning id into rid;
  update public.personal_notes set record_id=rid,record_type=kind,revision=revision+1,updated_at=clock_timestamp() where id=nid;
  return jsonb_build_object('id',rid,'type',kind);
 end if;
 raise exception 'Ação inválida';
end $$;
