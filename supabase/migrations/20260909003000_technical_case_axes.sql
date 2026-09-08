-- Additive migration. Legacy columns remain for existing flight/action relationships.
-- CLI unavailable in this workspace; migration is tracked and applied through Supabase MCP.
begin;
alter table public.maintenance_records add column technical_case jsonb;
alter table public.maintenance_records add column legacy_type jsonb;
create table public.technical_case_audit (
 id bigint generated always as identity primary key, record_id uuid,
 event text not null, old_value jsonb, new_value jsonb,
 employee_number text, actor_role text, at timestamptz not null default clock_timestamp(), reason text
);
create index technical_case_audit_record on public.technical_case_audit(record_id,id desc);
alter table public.technical_case_audit enable row level security;
revoke all on public.technical_case_audit from public,anon,authenticated;
create table private.technical_operator_config (
 id boolean primary key default true check(id), revision int not null default 1,
 data jsonb not null default '{"permissions":{},"cdlEnabled":false,"procedures":[],"recipients":[]}'
);
alter table private.technical_operator_config enable row level security;
revoke all on private.technical_operator_config from public,anon,authenticated;
insert into private.technical_operator_config(id) values(true);
create table public.technical_case_alerts (
 id bigint generated always as identity primary key, record_id uuid not null references public.maintenance_records(id),
 employee_number text not null, kind text not null, message text not null, at timestamptz not null default now(),
 unique(record_id,employee_number,kind)
);
alter table public.technical_case_alerts enable row level security;
revoke all on public.technical_case_alerts from public,anon,authenticated;
grant select on public.technical_case_alerts to authenticated;
create policy "technical alerts own recipient" on public.technical_case_alerts for select to authenticated using(employee_number=private.note_actor());

create function private.technical_actor() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('employee',d.employee_number,'role',coalesce(u.job_role,u.access_profile),'admin',d.is_admin or u.access_profile in('admin','app_manager'),'base',d.assigned_base)
 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active
$$;
create function private.technical_access(r public.maintenance_records) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((a->>'admin')::boolean,false) or (a->>'role' in('mechanic','maintenance_assistant','maintenance_inspector','maintenance_coordinator','maintenance_leader','maintenance_manager','maintenance_director','engineering','mcc','legacy') and (nullif(a->>'base','') is null or a->>'base'=r.base))
 from (select private.technical_actor() a)s where a is not null
$$;
create function private.technical_allowed(capability text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(c.data#>'{permissions}'->capability ? (a->>'employee'),false)
 from private.technical_operator_config c cross join (select private.technical_actor() a)s where c.id and a is not null
$$;
revoke all on function private.technical_actor(),private.technical_access(public.maintenance_records),private.technical_allowed(text) from public,anon,authenticated;
-- Invoker read policy keeps the same maintenance-only visibility; no pilot access to all maintenance.
grant execute on function private.technical_access(public.maintenance_records) to authenticated;
grant select on public.technical_case_audit to authenticated;
create policy "technical audit authorized case" on public.technical_case_audit for select to authenticated using(record_id is not null and exists(select 1 from public.maintenance_records r where r.id=record_id and private.technical_access(r)));

-- Conservative backfill: no official number or APRS is inferred from old labels/results.
update public.maintenance_records set legacy_type=jsonb_build_object('recordType',record_type,'priority',priority,'status',status,'data',data),
 technical_case=jsonb_build_object('report',case when record_type='inspection' then 'report' else 'discrepancy' end,'official',case when record_type='inspection' then 'evaluation' else 'pending' end,'aircraft','evaluation','investigation','triage','migratedAt',now());
insert into public.technical_case_audit(record_id,event,old_value,new_value,actor_role,reason)
 select id,'migration',legacy_type,technical_case,'migration','Valores originais preservados; nenhuma liberação ou dispensa de registro presumida.' from public.maintenance_records;
alter table public.maintenance_records alter column technical_case set default '{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage"}';
alter table public.maintenance_records alter column technical_case set not null;

create function private.guard_technical_case() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); c jsonb; o jsonb:='{}'; cfg jsonb; d jsonb; reason text; maintenance boolean; valid_aprs boolean; valid_defer boolean; changed boolean; entry jsonb;
begin
 if tg_op='DELETE' then raise exception 'Registros técnicos não podem ser apagados. Use cancelamento com motivo.';end if;
 c:=new.technical_case; reason:=nullif(trim(c->>'reason'),'');
 if tg_op='UPDATE' then o:=old.technical_case;
  if new.legacy_type is distinct from old.legacy_type then raise exception 'Histórico legado é imutável';end if;
  if new.created_by<>old.created_by or new.created_at<>old.created_at or new.prefix<>old.prefix or new.record_type<>old.record_type then raise exception 'Identidade do registro confirmado é imutável';end if;
  if c->>'parentId' is distinct from o->>'parentId' then raise exception 'Vínculo de recorrência é imutável';end if;
  for entry in select value from jsonb_array_elements(coalesce(old.data->'entries','[]')) loop
   if not coalesce(new.data->'entries','[]') @> jsonb_build_array(entry) then raise exception 'Comentários e execuções confirmados são preservados. Acrescente uma correção com motivo.';end if;
  end loop;
  if (new.title is distinct from old.title or new.data->>'description' is distinct from old.data->>'description') and reason is null then raise exception 'Correção do texto confirmado exige justificativa';end if;
 else
  new.legacy_type:=coalesce(new.legacy_type,jsonb_build_object('recordType',new.record_type,'priority',new.priority,'source','created_after_migration'));
  -- Incoming older clients reporting a fault must not create an exception to official review.
  if new.record_type='fault' and not(new.data ? 'technicalCase') then c:=c||'{"report":"discrepancy","official":"pending"}';end if;
 end if;
 if jsonb_typeof(c)<>'object' or coalesce(c->>'report','') not in('report','observation','discrepancy','trend','question','recurrence') or coalesce(c->>'official','') not in('evaluation','pending','linked','not_applicable') or coalesce(c->>'aircraft','') not in('evaluation','unavailable','maintenance','deferred','released','monitoring') or coalesce(c->>'investigation','') not in('triage','troubleshooting','engineering','parts','test','test_passed','test_failed','aprs','monitoring','recurrence','closed') then raise exception 'Eixos técnicos inválidos';end if;
 if tg_op='UPDATE' and c->>'report' is distinct from o->>'report' then
  if not private.technical_allowed('classify') or reason is null then raise exception 'Reclassificação exige autorização e justificativa';end if;
 end if;
 if c->>'report'='discrepancy' and c->>'official'='evaluation' then c:=c||'{"official":"pending"}';end if;
 if c->>'official'='linked' and nullif(trim(c->>'officialId'),'') is null then raise exception 'Informe o identificador da discrepância no eDB';end if;
 if c->>'official'='not_applicable' then
  if c->>'report' in('discrepancy','recurrence') then raise exception 'Reclassifique com justificativa antes de declarar não aplicável';end if;
  if (c->>'official' is distinct from o->>'official' or c->>'notApplicableReason' is distinct from o->>'notApplicableReason') then
   if not private.technical_allowed('not_applicable') or nullif(trim(c->>'notApplicableReason'),'') is null or reason is null then raise exception 'Não aplicável exige responsável autorizado e justificativa';end if;
   c:=c||jsonb_build_object('notApplicableBy',a->>'employee','notApplicableAt',now());
  else c:=c||jsonb_build_object('notApplicableBy',o->>'notApplicableBy','notApplicableAt',o->>'notApplicableAt');end if;
 end if;
 select data into cfg from private.technical_operator_config where id;
 if nullif(c->>'aprsRef','') is distinct from nullif(o->>'aprsRef','') then
  if not private.technical_allowed('aprs') or reason is null then raise exception 'Confirmação da APRS exige autorização e motivo';end if;
  c:=c||jsonb_build_object('aprsBy',a->>'employee','aprsAt',now());
 else c:=c||jsonb_build_object('aprsBy',o->>'aprsBy','aprsAt',o->>'aprsAt');end if;
 if coalesce((c->>'officialClosed')::boolean,false) is distinct from coalesce((o->>'officialClosed')::boolean,false) then
  if not private.technical_allowed('aprs') or reason is null or c->>'official'<>'linked' then raise exception 'Confirmar encerramento da discrepância no eDB exige autorização e vínculo';end if;
  c:=c||jsonb_build_object('officialClosedBy',a->>'employee','officialClosedAt',now());
 else c:=c||jsonb_build_object('officialClosedBy',o->>'officialClosedBy','officialClosedAt',o->>'officialClosedAt');end if;
 d:=coalesce(c->'disposition','{}');
 if d is distinct from coalesce(o->'disposition','{}') then
  if not private.technical_allowed('defer') or reason is null then raise exception 'Disposição exige autorização e justificativa';end if;
  if coalesce(d->>'type','') not in('none','MEL','CDL','procedure') then raise exception 'Tipo de disposição inválido';end if;
  if d->>'type'='CDL' and not coalesce((cfg->>'cdlEnabled')::boolean,false) then raise exception 'CDL não configurada para este operador';end if;
  if d->>'type'='procedure' and not coalesce(cfg->'procedures','[]') ? coalesce(d->>'reference','') then raise exception 'Procedimento não cadastrado previamente pelo operador';end if;
  if d->>'type'<>'none' then
   if nullif(d->>'reference','') is null or nullif(d->>'conditions','') is null or nullif(d->>'deadline','') is null then raise exception 'Informe referência, condições e prazo';end if;
   if (d->>'deadline')::timestamptz<=now() then raise exception 'O prazo da disposição deve estar vigente';end if;
   if d->>'type'='MEL' and (nullif(d->>'melItem','') is null or nullif(d->>'revision','') is null or nullif(d->>'maintenanceProcedures','') is null or nullif(d->>'operationalProcedures','') is null or nullif(d->>'category','') is null or nullif(d->>'weather','') is null) then raise exception 'Complete item, revisão, categoria/prazo, procedimentos e condições meteorológicas da MEL (ou não aplicável justificado)';end if;
   if d->>'type'='CDL' and (nullif(d->>'cdlItem','') is null or nullif(d->>'revision','') is null or nullif(d->>'performance','') is null) then raise exception 'Complete item, revisão e limitações de desempenho da CDL';end if;
  end if;
  d:=d||jsonb_build_object('authorizedBy',a->>'employee','authorizedAt',now());c:=c||jsonb_build_object('disposition',d);
 end if;
 -- Only explicit human review can resolve a critical flag. New evidence resets the review.
 changed:=tg_op='INSERT' or new.data is distinct from old.data or new.title is distinct from old.title;
 if changed and lower(new.title||' '||new.data::text) ~ '(falha presente.{0,40}vai voar|liberado somente para cumprir o voo|teste n[aã]o realizado|colocado ok para produzir)' then c:=c||'{"critical":true,"criticalBy":null,"criticalAt":null,"criticalReview":null}';
 elsif c->>'criticalReview' is distinct from o->>'criticalReview' then
  if not private.technical_allowed('critical') or nullif(c->>'criticalReview','') is null or reason is null then raise exception 'Alerta crítico exige avaliação formal de responsável autorizado';end if;
  c:=c||jsonb_build_object('critical',false,'criticalBy',a->>'employee','criticalAt',now());
 else c:=c||jsonb_build_object('critical',coalesce((o->>'critical')::boolean,false),'criticalBy',o->>'criticalBy','criticalAt',o->>'criticalAt');end if;
 valid_aprs:=nullif(c->>'aprsRef','') is not null and nullif(c->>'aprsBy','') is not null;
 valid_defer:=d->>'type' in('MEL','CDL','procedure') and nullif(d->>'authorizedBy','') is not null and (d->>'deadline')::timestamptz>now();
 maintenance:=c->>'investigation' in('troubleshooting','test','test_passed','test_failed','aprs','monitoring') or exists(select 1 from jsonb_array_elements(coalesce(new.data->'entries','[]'))e where e->>'kind'='action');
 if c->>'investigation' in('aprs','monitoring') and not valid_aprs then raise exception 'Este estágio exige APRS confirmada';end if;
 if c->>'aircraft' in('released','deferred','monitoring') then
  if c->>'aircraft' is distinct from o->>'aircraft' or c is distinct from o then
   if not private.technical_allowed('release') or reason is null then raise exception 'Situação liberada exige confirmação de profissional autorizado';end if;
  end if;
  if coalesce((c->>'critical')::boolean,false) or c->>'investigation'='test_failed' then raise exception 'Alerta crítico ou teste não satisfatório impede esta liberação';end if;
  if not(valid_aprs or valid_defer) then raise exception 'Sem APRS ou disposição formal válida, não é possível registrar liberação';end if;
  if c->>'aircraft'='deferred' and not valid_defer then raise exception 'Diferimento válido obrigatório';end if;
  if c->>'aircraft'='released' and maintenance and not valid_aprs then raise exception 'Liberação após manutenção exige APRS confirmada';end if;
  if c->>'aircraft'='monitoring' or c->>'investigation'='monitoring' then
   if not valid_aprs or not coalesce((c->>'officialClosed')::boolean,false) or c->>'official'<>'linked' then raise exception 'Monitoramento pós-APRS exige discrepância encerrada no eDB';end if;
  elsif c->>'report' in('discrepancy','recurrence') and not valid_defer and not coalesce((c->>'officialClosed')::boolean,false) then raise exception 'Confirme o encerramento da discrepância no eDB';end if;
 end if;
 if c->>'investigation'='closed' and o->>'investigation' is distinct from 'closed' then
  if not private.technical_allowed('close') or reason is null then raise exception 'Encerramento exige autorização e motivo';end if;
  if c->>'official'='pending' or (c->>'report' in('discrepancy','recurrence') and not coalesce((c->>'officialClosed')::boolean,false)) then raise exception 'Resolva o vínculo oficial antes de encerrar';end if;
 end if;
 if nullif(c->>'cancelledReason','') is distinct from nullif(o->>'cancelledReason','') and not private.technical_allowed('close') then raise exception 'Cancelamento exige autorização';end if;
 if tg_op='UPDATE' and new.record_type<>'inspection' and new.status is distinct from old.status and c->>'investigation'<>'closed' then raise exception 'Use o fluxo de encerramento do caso técnico';end if;
 new.technical_case:=c;
 return new;
end $$;
revoke all on function private.guard_technical_case() from public,anon,authenticated;
create trigger z_guard_technical_case before insert or update or delete on public.maintenance_records for each row execute function private.guard_technical_case();

create function private.audit_technical_case() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); event_name text;
begin
 event_name:=case when tg_op='INSERT' then 'create' when new.technical_case->>'cancelledReason' is distinct from old.technical_case->>'cancelledReason' then 'cancel' when new.technical_case is distinct from old.technical_case then 'transition' when new.tc is distinct from old.tc then 'tc_link' else 'confirmed_record_update' end;
 insert into public.technical_case_audit(record_id,event,old_value,new_value,employee_number,actor_role,reason) values(new.id,event_name,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),a->>'employee',a->>'role',new.technical_case->>'reason');
 if coalesce((new.technical_case->>'critical')::boolean,false) then
  insert into public.technical_case_alerts(record_id,employee_number,kind,message)
  select new.id,e,'critical','Alerta crítico em '||new.prefix||' · '||new.title||'. Avaliação e disposição formal necessárias.' from private.technical_operator_config c cross join lateral jsonb_array_elements_text(c.data->'recipients')e on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.audit_technical_case() from public,anon,authenticated;
create trigger zz_audit_technical_case after insert or update on public.maintenance_records for each row execute function private.audit_technical_case();

create function public.technical_case_action(p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); r public.maintenance_records; c jsonb; cfg private.technical_operator_config; rid uuid; permissions jsonb; capability text;
begin
 if a is null then raise exception 'Sessão não autorizada';end if;
 select * into cfg from private.technical_operator_config where id;
 if p_action='config' then
  select jsonb_object_agg(k,private.technical_allowed(k)) into permissions from unnest(array['classify','not_applicable','defer','aprs','release','close','critical']) k;
  return jsonb_build_object('data',case when (a->>'admin')::boolean then cfg.data else cfg.data-'permissions'-'recipients' end,'revision',cfg.revision,'canConfigure',(a->>'admin')::boolean,'permissions',permissions);
 elsif p_action='configure' then
  if not (a->>'admin')::boolean then raise exception 'Somente administração configura as autorizações do operador';end if;
  if cfg.revision<>(p_payload->>'revision')::int then raise exception 'Configuração alterada; atualize a tela';end if;
  c:=p_payload->'data';
  if jsonb_typeof(c->'permissions')<>'object' or jsonb_typeof(c->'procedures')<>'array' or jsonb_typeof(c->'recipients')<>'array' or jsonb_typeof(c->'cdlEnabled')<>'boolean' then raise exception 'Configuração inválida';end if;
  for capability in select jsonb_object_keys(c->'permissions') loop
   if capability not in('classify','not_applicable','defer','aprs','release','close','critical') or jsonb_typeof(c->'permissions'->capability)<>'array' then raise exception 'Permissão inválida';end if;
   if exists(select 1 from jsonb_array_elements_text(c->'permissions'->capability)e where not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active)) then raise exception 'Permissão vinculada a funcionário inexistente/inativo';end if;
  end loop;
  insert into public.technical_case_audit(event,old_value,new_value,employee_number,actor_role,reason) values('operator_configuration',cfg.data,c,a->>'employee',a->>'role',p_payload->>'reason');
  update private.technical_operator_config set data=c,revision=revision+1 where id;
  return public.technical_case_action('config');
 end if;
 select * into r from public.maintenance_records where id=p_id for update;
 if r.id is null or not coalesce(private.technical_access(r),false) then raise exception 'Caso não disponível para seu perfil/base';end if;
 if p_action='history' then return (select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]') from public.technical_case_audit h where record_id=p_id);end if;
 if r.revision<>coalesce((p_payload->>'revision')::bigint,-1) then raise exception 'Caso alterado em outro aparelho. Reabra antes de confirmar';end if;
 if p_action='recurrence' then
  if nullif(trim(p_payload->>'description'),'') is null then raise exception 'Descreva a recorrência';end if;
  rid:=gen_random_uuid();
  insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
  values(rid,'fault',r.base,r.model,r.prefix,'not_logged','open',r.title,a->>'employee',jsonb_build_object('technicalCase',true,'description',p_payload->>'description','links',jsonb_build_array(r.id),'entries','[]'::jsonb,'createdBy',a->>'employee'),jsonb_build_object('report','recurrence','official','pending','aircraft','evaluation','investigation','triage','parentId',r.id));
  insert into public.technical_case_audit(record_id,event,new_value,employee_number,actor_role,reason) values(r.id,'recurrence_link',jsonb_build_object('newRecordId',rid),a->>'employee',a->>'role',p_payload->>'description');
  return jsonb_build_object('id',rid);
 elsif p_action='update' then
  c:=p_payload->'case';
  if c is null then raise exception 'Informe os quatro eixos';end if;
  update public.maintenance_records set technical_case=c,tc=coalesce(p_payload->>'tc',tc),title=coalesce(p_payload->>'title',title),data=case when p_payload ? 'description' then jsonb_set(data,'{description}',p_payload->'description') else data end,
   status=case when c->>'investigation'='closed' then 'closed' else status end,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  return to_jsonb(r);
 end if;
 raise exception 'Action inconnue';
end $$;
revoke all on function public.technical_case_action(text,uuid,jsonb) from public,anon;
grant execute on function public.technical_case_action(text,uuid,jsonb) to authenticated;

create function private.audit_note_conversion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.record_id is not null and old.record_id is distinct from new.record_id then
 insert into public.technical_case_audit(record_id,event,old_value,new_value,employee_number,actor_role,reason) values(new.record_id,'note_conversion',jsonb_build_object('noteId',old.id,'author',old.employee_number,'title',old.title,'body',old.body,'createdAt',old.created_at),jsonb_build_object('recordId',new.record_id),private.note_actor(),private.technical_actor()->>'role','Conversão confirmada pelo autor');
 end if;return new;
end $$;
revoke all on function private.audit_note_conversion() from public,anon,authenticated;
create trigger audit_note_conversion after update of record_id on public.personal_notes for each row execute function private.audit_note_conversion();

create function private.technical_deadline_alerts() returns void language sql security definer set search_path='' as $$
 insert into public.technical_case_alerts(record_id,employee_number,kind,message)
 select r.id,e,'deadline:'||(r.technical_case#>>'{disposition,deadline}'),'Prazo de disposição: '||r.prefix||' · '||r.title||' · '||(r.technical_case#>>'{disposition,deadline}')
 from public.maintenance_records r cross join private.technical_operator_config c cross join lateral jsonb_array_elements_text(c.data->'recipients') e
 where r.technical_case->>'aircraft'='deferred' and nullif(r.technical_case#>>'{disposition,deadline}','')::timestamptz<=now()+interval '24 hours'
 on conflict do nothing
$$;
revoke all on function private.technical_deadline_alerts() from public,anon,authenticated;
select cron.schedule('technical-disposition-reminders','*/5 * * * *','select private.technical_deadline_alerts()');
commit;
