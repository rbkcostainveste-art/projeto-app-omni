-- Resolve current job roles instead of legacy access categories.
create or replace function private.cockpit_access(k text,s text,fid text,creator text,writing boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; role_name text; admin boolean; f jsonb;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile),(d.is_admin or u.access_profile in ('admin','app_manager')) into actor,role_name,admin from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then return false; end if;
 if admin then return true; end if;
 if k in ('settings','location','contract') then return not writing;end if;
 if k in ('qualification','person') then return not writing and s=actor;end if;
 if role_name not in ('commander','copilot','flight_attendant','coordination','dispatch') then return false;end if;
 if k='duty' then return s=actor;end if;
 if k='occurrence' and creator=actor then return true;end if;
 if k='occurrence' and role_name in ('coordination','dispatch') then return true;end if;
 if fid is null then return k='occurrence' and writing and creator=actor;end if;
 select x into f from public.shared_app_state state cross join lateral jsonb_array_elements(state.flights) x where state.id='main' and x->>'id'=fid and coalesce(x->>'deletedAt','')='';
 return coalesce(f is not null and (role_name in ('coordination','dispatch') or actor in (f->>'commander',f->>'copilot',f->>'flightAttendant')),false);
end $$;
revoke all on function private.cockpit_access(text,text,text,text,boolean) from public,anon,authenticated;

create or replace function public.cockpit(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; role_name text; admin boolean; item public.cockpit_entries; old public.cockpit_entries; k text; body jsonb; fid text; subject_id text; identifier text; f jsonb; numeric_key text; value text; record_id uuid; result jsonb; a timestamptz; b timestamptz; ms timestamptz; me timestamptz;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile),(d.is_admin or u.access_profile in ('admin','app_manager')) into actor,role_name,admin from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.updated_at desc) from public.cockpit_entries e where private.cockpit_access(e.kind,e.subject,e.flight_id,e.created_by,false) and (nullif(p_payload->>'kind','') is null or e.kind=p_payload->>'kind') and (nullif(p_payload->>'subject','') is null or e.subject=p_payload->>'subject')),'[]');
 end if;
 if p_action='history' then
  select * into item from public.cockpit_entries where id=p_payload->>'id';
  if item.id is null or not private.cockpit_access(item.kind,item.subject,item.flight_id,item.created_by,false) then raise exception 'Registro indisponível';end if;
  return coalesce((select jsonb_agg(to_jsonb(h) order by h.revision desc) from public.cockpit_audit h where h.entry_id=item.id),'[]');
 end if;
 if p_action='technical_history' then
  fid:=p_payload->>'flightId';
  if not private.cockpit_access('preparation',null,fid,actor,false) then raise exception 'Voo indisponível';end if;
  select x into f from public.shared_app_state state cross join lateral jsonb_array_elements(state.flights) x where state.id='main' and x->>'id'=fid;
  -- Only the technical summary needed for preparation, never comments, chats or execution history.
  return coalesce((select jsonb_agg(jsonb_build_object('code',r.ticket_code,'title',r.title,'type',r.record_type,'status',r.status,'priority',r.priority)) from public.maintenance_records r where r.prefix=f->>'prefix' and r.status='open'),'[]');
 end if;
 if p_action='export' then
  fid:=p_payload->>'flightId';
  if not private.cockpit_access('preparation',null,fid,actor,false) then raise exception 'Voo indisponível';end if;
  select x into f from public.shared_app_state state cross join lateral jsonb_array_elements(state.flights) x where state.id='main' and x->>'id'=fid;
  return jsonb_build_object('schemaVersion',1,'official',false,'externalStatus','not_connected','exportedAt',now(),'exportedBy',actor,'flight',f,'operation',(select jsonb_build_object('events',o.events,'checks',o.checks,'revision',o.revision) from public.flight_operation_records o where o.flight_id=fid),'records',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.cockpit_entries e where e.flight_id=fid and e.kind in ('preparation','document','diary','counter') and private.cockpit_access(e.kind,e.subject,e.flight_id,e.created_by,false)));
 end if;
 if p_action not in ('save','acknowledge','prepare_export','reopen','send_maintenance') then raise exception 'Ação inválida';end if;
 identifier:=nullif(p_payload->>'id','');if identifier is null then raise exception 'Identificador necessário';end if;
 perform pg_advisory_xact_lock(hashtextextended('cockpit:'||identifier,0));
 select * into old from public.cockpit_entries where id=identifier for update;
 k:=coalesce(old.kind,p_payload->>'kind'); fid:=coalesce(old.flight_id,nullif(p_payload->>'flightId','')); subject_id:=coalesce(old.subject,nullif(p_payload->>'subject',''));
 if not coalesce(private.cockpit_access(k,subject_id,fid,coalesce(old.created_by,actor),true),false) then raise exception 'Sem permissão para alterar este registro';end if;
 if old.id is not null and old.revision<>coalesce((p_payload->>'revision')::integer,0) then raise exception 'Este registro mudou. Reabra antes de salvar para preservar as alterações';end if;
 body:=case when p_action='save' then p_payload->'data' else old.data end;
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>100000 then raise exception 'Conteúdo inválido ou muito grande';end if;
 if k in ('person','qualification','duty') and subject_id is null then raise exception 'Selecione a matrícula';end if;
 if k in ('preparation','document','diary','counter') and fid is null then raise exception 'Selecione o voo';end if;
 if k='person' then
  if exists(select 1 from public.authorized_users where employee_number=subject_id and coalesce(job_role,access_profile) in ('toolroom','coordination','dispatch')) then body:=body||jsonb_build_object('regime','Mensalista');end if;
 end if;
 -- Clients cannot manufacture synchronization or signatures.
 body:=(body-'acknowledgment'-'externalStatus'-'externalReceipt'-'maintenanceId'-'maintenanceCode'-'preparedAt'-'preparedBy')||jsonb_build_object('externalStatus','not_connected');
 if old.id is not null then body:=body||jsonb_build_object('maintenanceId',old.data->'maintenanceId','maintenanceCode',old.data->'maintenanceCode');end if;
 if p_action not in ('save','reopen') and old.data->>'preparedAt' is not null then body:=body||jsonb_build_object('preparedAt',old.data->'preparedAt','preparedBy',old.data->'preparedBy');end if;
 if p_action='save' and old.data->>'preparedAt' is not null then raise exception 'Reabra o rascunho antes de alterar';end if;
 foreach numeric_key in array array['passengers','cargoKg','plannedFuel','alternateFuel','reserveFuel','previous','current','flightMinutes','nightMinutes','flightDaily','flightMonthly','flightYearly','dutyMonthly'] loop
  value:=nullif(body->>numeric_key,'');
  if value is not null and (value !~ '^\d+(\.\d+)?$' or length(value)>12) then raise exception 'Valor numérico inválido: %',numeric_key;end if;
 end loop;
 if k='counter' then
  if nullif(body->>'previous','') is not null and nullif(body->>'current','') is not null then
   if (body->>'current')::numeric<(body->>'previous')::numeric then raise exception 'Atual menor que anterior: registre troca ou correção em um novo contador';end if;
   body:=body||jsonb_build_object('delta',(body->>'current')::numeric-(body->>'previous')::numeric);
  else body:=body-'delta';end if;
 end if;
 if k='duty' then
  if nullif(body->>'date','') is null then raise exception 'Informe a data da jornada';end if;
  perform (body->>'date')::date;
  a:=nullif(body->>'presentation','')::timestamptz;b:=nullif(body->>'release','')::timestamptz;ms:=nullif(body->>'mealStart','')::timestamptz;me:=nullif(body->>'mealEnd','')::timestamptz;
  if b<a or me<ms or ms<a or me>b then raise exception 'Confira a ordem dos horários de apresentação, refeição e liberação';end if;
  if (ms is null)<>(me is null) then raise exception 'Preencha início e fim da refeição juntos';end if;
  if coalesce(nullif(body->>'nightMinutes','')::numeric,0)>coalesce(nullif(body->>'flightMinutes','')::numeric,0) then raise exception 'Voo noturno não pode superar o total de voo';end if;
  body:=body||jsonb_build_object('elapsedMinutes',case when a is not null and b is not null then floor(extract(epoch from(b-a))/60) end,'mealMinutes',case when ms is not null and me is not null then floor(extract(epoch from(me-ms))/60) else 0 end);
 end if;
 if k='occurrence' and nullif(btrim(body->>'title'),'') is null then raise exception 'Informe o título da ocorrência';end if;
 if p_action='acknowledge' then
  if old.id is null or k not in ('duty','diary','document') then raise exception 'Salve o registro antes de dar ciência';end if;
  if k='diary' and not (admin or role_name='commander') then raise exception 'Somente comandante registra ciência do diário';end if;
  body:=body||jsonb_build_object('acknowledgment',jsonb_build_object('actor',actor,'at',now(),'revision',old.revision));
 elsif p_action='prepare_export' then
  if k<>'diary' or old.id is null then raise exception 'Salve o rascunho do diário';end if;
  body:=body||jsonb_build_object('preparedAt',now(),'preparedBy',actor);
 elsif p_action='reopen' then
  if k<>'diary' or not (admin or role_name in ('commander','coordination')) then raise exception 'Sem permissão para reabrir';end if;
  if nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'Informe o motivo da reabertura';end if;
  body:=body||jsonb_build_object('reopenReason',p_payload->>'reason');
 elsif p_action='send_maintenance' then
  if k<>'occurrence' or old.id is null then raise exception 'Salve a ocorrência primeiro';end if;
  if nullif(old.data->>'maintenanceId','') is not null then return to_jsonb(old);end if;
  if body->>'technicalType' not in ('fault','discrepancy') or body->>'technicalType' is null then raise exception 'Selecione pane ou discrepância';end if;
  select x into f from public.shared_app_state state cross join lateral jsonb_array_elements(state.catalogs->'aircraft') x where state.id='main' and x->>'prefix'=body->>'prefix';
  if f is null then raise exception 'Selecione uma aeronave cadastrada para enviar à manutenção';end if;
  record_id:=gen_random_uuid();
  insert into public.maintenance_records(id,record_type,base,model,prefix,priority,title,source_flight_id,created_by,data)
  values(record_id,body->>'technicalType',f->>'base',f->>'model',f->>'prefix',case when body->>'technicalType'='fault' then 'not_logged' when body->>'priority'='urgent' then 'urgent' else 'routine' end,body->>'title',fid::uuid,actor,jsonb_build_object('description',coalesce(body->>'description',''),'assignedTo','[]'::jsonb,'links','[]'::jsonb,'entries','[]'::jsonb,'cockpitOccurrenceId',identifier));
  body:=body||jsonb_build_object('maintenanceId',record_id,'maintenanceCode',(select ticket_code from public.maintenance_records where id=record_id));
 end if;
 insert into public.cockpit_entries(id,kind,subject,flight_id,data,created_by,updated_by) values(identifier,k,subject_id,fid,body,actor,actor)
 on conflict(id) do update set data=excluded.data,revision=cockpit_entries.revision+1,updated_by=actor,updated_at=now() returning * into item;
 insert into public.cockpit_audit(entry_id,revision,actor,data) values(item.id,item.revision,actor,item.data);
 return to_jsonb(item);
end $$;
revoke all on function public.cockpit(text,jsonb) from public,anon;
grant execute on function public.cockpit(text,jsonb) to authenticated;
