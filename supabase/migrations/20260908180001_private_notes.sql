create table public.personal_notes (
 id uuid primary key, employee_number text not null, title text not null, body text not null default '', prefix text not null default '', attachments jsonb not null default '[]',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision int not null default 1,
 remind_at timestamptz, reminder_version int not null default 0, reminder_done boolean not null default false, reminder_attempts int not null default 0, reminder_available_at timestamptz, reminder_status text,
 record_id uuid, record_type text
);
create index personal_notes_owner_page on public.personal_notes(employee_number,updated_at desc,id);
create index personal_notes_due on public.personal_notes(reminder_available_at) where remind_at is not null and not reminder_done;
alter table public.personal_notes enable row level security;
revoke all on public.personal_notes from anon,authenticated;
grant all on public.personal_notes to service_role;
create function private.note_actor() returns text language sql stable security definer set search_path='' as $$
 select d.employee_number from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active
$$;
revoke all on function private.note_actor() from public,anon;
grant execute on function private.note_actor() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('personal-notes','personal-notes',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime']) on conflict(id) do nothing;
create policy "notes owner reads media" on storage.objects for select to authenticated using(bucket_id='personal-notes' and split_part(name,'/',1)=private.note_actor());
create policy "notes owner uploads media" on storage.objects for insert to authenticated with check(bucket_id='personal-notes' and split_part(name,'/',1)=private.note_actor());
create policy "notes owner deletes media" on storage.objects for delete to authenticated using(bucket_id='personal-notes' and split_part(name,'/',1)=private.note_actor());

create function public.personal_note(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=private.note_actor(); n public.personal_notes; nid uuid; media jsonb; reminder timestamptz; a record; d public.device_identities; kind text; priority text; recdata jsonb; rid uuid;
begin
 if actor is null or actor is distinct from p_payload->>'employee' then raise exception 'Entre novamente para abrir suas notas';end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id desc),'[]') from (select * from public.personal_notes where employee_number=actor and (coalesce(p_payload->>'search','')='' or strpos(lower(title||' '||body||' '||replace(prefix,'-','')),lower(replace(p_payload->>'search','-','')))>0) and (nullif(p_payload->>'before','') is null or (updated_at,id)<((p_payload->>'before')::timestamptz,(p_payload->>'beforeId')::uuid)) order by updated_at desc,id desc limit 50)t);
 end if;
 nid:=(p_payload->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(nid::text,0));
 select * into n from public.personal_notes where id=nid for update;
 if n.id is not null and n.employee_number<>actor then raise exception 'Nota não encontrada';end if;
 if p_action='save' then
  if n.id is not null and coalesce((p_payload->>'revision')::int,0)=0 then return to_jsonb(n);end if;
  if n.id is not null and n.revision<>(p_payload->>'revision')::int then raise exception 'A nota foi alterada em outro aparelho. Reabra antes de salvar';end if;
  if trim(coalesce(p_payload->>'title',''))='' or length(p_payload->>'title')>160 or length(coalesce(p_payload->>'body',''))>16000 then raise exception 'Informe título de até 160 caracteres e texto de até 16000';end if;
  if coalesce(p_payload->>'prefix','')<>'' and not exists(select 1 from public.aircraft where prefix=p_payload->>'prefix' and active) then raise exception 'Selecione uma aeronave cadastrada';end if;
  media:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(media)<>'array' or jsonb_array_length(media)>10 then raise exception 'Limite de 10 imagens ou vídeos';end if;
  if exists(select 1 from jsonb_array_elements(media)m where m->>'type' not in('image','video') or m->>'bucket' is distinct from 'personal-notes' or split_part(m->>'url','/',1) is distinct from actor or split_part(m->>'url','/',2) is distinct from nid::text or not exists(select 1 from storage.objects o where o.bucket_id='personal-notes' and o.name=m->>'url')) then raise exception 'Anexo inválido';end if;
  reminder:=nullif(p_payload->>'remindAt','')::timestamptz;
  if reminder is distinct from n.remind_at and reminder<now() then raise exception 'Escolha data e horário futuros';end if;
  insert into public.personal_notes(id,employee_number,title,body,prefix,attachments,remind_at,reminder_available_at) values(nid,actor,trim(p_payload->>'title'),coalesce(p_payload->>'body',''),coalesce(p_payload->>'prefix',''),media,reminder,reminder)
  on conflict(id) do update set title=excluded.title,body=excluded.body,prefix=excluded.prefix,attachments=excluded.attachments,updated_at=clock_timestamp(),revision=personal_notes.revision+1,remind_at=excluded.remind_at,
   reminder_version=personal_notes.reminder_version+case when personal_notes.remind_at is distinct from excluded.remind_at then 1 else 0 end,
   reminder_done=case when personal_notes.remind_at is distinct from excluded.remind_at then false else personal_notes.reminder_done end,
   reminder_attempts=case when personal_notes.remind_at is distinct from excluded.remind_at then 0 else personal_notes.reminder_attempts end,
   reminder_status=case when personal_notes.remind_at is distinct from excluded.remind_at then null else personal_notes.reminder_status end,
   reminder_available_at=case when personal_notes.remind_at is distinct from excluded.remind_at then excluded.remind_at else personal_notes.reminder_available_at end returning * into n;
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
  select ac.prefix,mo.name model,ba.name base into a from public.aircraft ac join public.aircraft_models mo on mo.id=ac.model_id join public.operation_bases ba on ba.id=ac.operation_base_id where ac.prefix=p_payload->>'prefix' and ac.active;
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
revoke all on function public.personal_note(text,jsonb) from public,anon;
grant execute on function public.personal_note(text,jsonb) to authenticated;
create function public.claim_note_reminders() returns setof public.personal_notes language sql security definer set search_path='' as $$
 update public.personal_notes set reminder_attempts=reminder_attempts+1,reminder_available_at=now()+interval '2 minutes' where id in(select id from public.personal_notes where remind_at<=now() and not reminder_done and reminder_attempts<5 and reminder_available_at<=now() order by reminder_available_at for update skip locked limit 50) returning *
$$;
revoke all on function public.claim_note_reminders() from public,anon,authenticated;
grant execute on function public.claim_note_reminders() to service_role;
select cron.schedule('personal-note-reminders','* * * * *',$cron$select net.http_post(url:='https://ecdhhfyobalpswojaklv.supabase.co/functions/v1/send-note-reminders',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='push_cron_secret')),body:='{}'::jsonb);$cron$);
