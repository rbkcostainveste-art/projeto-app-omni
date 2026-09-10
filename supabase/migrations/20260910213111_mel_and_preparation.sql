-- MEL dates are evidence from official records, never the app creation timestamp.
create function private.guard_mel_dates() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb:=coalesce(new.technical_case->'disposition','{}'); o jsonb:='{}'; found_at timestamptz; applied_at timestamptz; zone text; days integer; cap integer;
begin
 if tg_op='UPDATE' then o:=coalesce(old.technical_case->'disposition','{}');end if;
 if d->>'type'='MEL' and d is distinct from o and (d ? 'discoveredAt' or d ? 'repairCategory') then
  if not coalesce(private.technical_allowed('defer'),false) then raise exception 'Somente responsável autorizado pode ajustar o prazo MEL';end if;
  if nullif(btrim(new.technical_case->>'officialId'),'') is null then raise exception 'Informe a referência do registro oficial';end if;
  found_at:=nullif(d->>'discoveredAt','')::timestamptz;applied_at:=nullif(d->>'deferredAt','')::timestamptz;zone:=d->>'timeZone';
  if found_at is null or applied_at is null or found_at>clock_timestamp() or applied_at>clock_timestamp() or applied_at<found_at then raise exception 'Confira descoberta e aplicação do diferimento: datas passadas, em ordem';end if;
  if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Informe o fuso previsto na MEL';end if;
  if d->>'repairCategory' in('B','C','D') then
   cap:=case d->>'repairCategory' when 'B' then 3 when 'C' then 10 else 120 end;
   if coalesce(d->>'repairDays','') !~ '^[0-9]+$' then raise exception 'Informe dias calendáricos inteiros';end if;
   days:=(d->>'repairDays')::int;
   if days<1 or days>cap then raise exception 'Prazo superior ao permitido para a categoria';end if;
   d:=d||jsonb_build_object('deadline',(((found_at at time zone zone)::date+days+1)::timestamp at time zone zone),'deadlineMode','calendar');
  elsif d->>'repairCategory'='A' then
   if nullif(btrim(d->>'calculationBasis'),'') is null or nullif(d->>'deadline','') is null then raise exception 'Categoria A exige regra do item e data limite conferida';end if;
   if d->>'deadlineMode' is distinct from 'manual' then raise exception 'Categoria A: confirme manualmente o limite do item; horas/ciclos exigem controle próprio';end if;
  else raise exception 'Selecione a categoria MEL A, B, C ou D';end if;
  if (d->>'deadline')::timestamptz<=found_at then raise exception 'O limite deve ser posterior à descoberta';end if;
  if coalesce(d->>'alertHours','48') not in ('24','48','72') then raise exception 'Antecedência inválida';end if;
  new.technical_case:=jsonb_set(new.technical_case,'{disposition}',d);
 end if;
 return new;
end $$;
revoke all on function private.guard_mel_dates() from public,anon,authenticated;
create trigger aaa_guard_mel_dates before insert or update on public.maintenance_records for each row execute function private.guard_mel_dates();

-- Permit historical expired entries for tracking, never confirm them as a valid deferral.
do $$ declare f text; begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,$a$if (d->>'deadline')::timestamptz<=now() then$a$,$b$if (d->>'deadline')::timestamptz<=now() and c->>'aircraft'='deferred' then$b$);execute f;
 select pg_get_functiondef('private.technical_deadline_alerts()'::regprocedure) into f;
 f:=replace(f,$a$ insert into public.technical_case_alerts(record_id,employee_number,kind,message)$a$,$b$ insert into public.technical_case_alerts(record_id,employee_number,kind,message)$b$);
 -- Keep the existing 24-hour and follow-up checks, add distinct early/expired events.
 f:=replace(f,'AS $function$', $b$AS $function$
 insert into public.technical_case_alerts(record_id,employee_number,kind,message)
 select r.id,e.employee,s.kind||(r.technical_case#>>'{disposition,deadline}'),s.label||r.prefix||' · '||r.title||' · '||(r.technical_case#>>'{disposition,deadline}')
 from public.maintenance_records r cross join private.technical_recipients_for_base(r.base) e
 cross join (values ('melsoon:','MEL próxima do limite: '),('meloverdue:','MEL vencida · reavaliar: ')) s(kind,label)
 where r.technical_case->>'aircraft'='deferred' and r.technical_case#>>'{disposition,type}'='MEL'
 and nullif(r.technical_case#>>'{disposition,deadline}','')::timestamptz<=now()+case when s.kind='meloverdue:' then interval '0 hours' else coalesce(nullif(r.technical_case#>>'{disposition,alertHours}','')::int,48)*interval '1 hour' end
 on conflict do nothing;
 $b$);execute f;
 select pg_get_functiondef('public.technical_case_action(text,uuid,jsonb)'::regprocedure) into f;
 f:=replace(f,$a$t.kind='deadline:'||(m.technical_case#>>'{disposition,deadline}')$a$,$b$t.kind in ('deadline:'||(m.technical_case#>>'{disposition,deadline}'),'melsoon:'||(m.technical_case#>>'{disposition,deadline}'),'meloverdue:'||(m.technical_case#>>'{disposition,deadline}'))$b$);execute f;
end $$;

alter table public.flight_operation_records add column preparation jsonb not null default '{}';

create function private.preparation_state(p_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb:=private.operation_flight(p_id);ctx jsonb:=private.operation_context(p_id);r public.flight_operation_records;k text;keys text[];pending jsonb:='[]';fingerprint text;blocked boolean;valid boolean;
begin
 select * into r from public.flight_operation_records where flight_id=p_id;
 keys:=case when nullif(f->>'maintenancePostId','') is not null then array['fuel','inspection'] when (ctx->>'first')::boolean then array['drain','fuel','inspection','hums'] else array['fuel','inspection','hums'] end;
 foreach k in array keys loop
  if r.checks#>>array[k,'approval','result'] is distinct from 'ok'
   or r.checks#>>array[k,'targetFlightId'] is distinct from (case when k='inspection' and not (ctx->>'first')::boolean then ctx->>'previousFlightId' else p_id end)
   or r.checks#>>array[k,'kind'] is distinct from (case when k='inspection' then case when (ctx->>'first')::boolean then 'preflight' else 'between' end else k end)
  then pending:=pending||to_jsonb(k);end if;
 end loop;
 select exists(select 1 from public.maintenance_records m where m.prefix=f->>'prefix' and m.record_type<>'inspection' and m.status<>'closed' and (
  m.technical_case->>'aircraft' in('unavailable','maintenance','evaluation') or coalesce((m.technical_case->>'critical')::boolean,false) or m.technical_case->>'investigation'='test_failed'
  or (m.technical_case->>'report' in('discrepancy','recurrence') and not coalesce(private.technical_valid_disposition(m.technical_case),false))
  or (m.technical_case->>'aircraft'='deferred' and nullif(m.technical_case#>>'{disposition,deadline}','')::timestamptz<=now()))) into blocked;
 fingerprint:=md5(jsonb_build_array(f->'prefix',f->'date',f->'base',f->'model',f->'fuelAmount',f->'fuelUnit',f->'destination',f->'departure',f->'spot',f->'commander',f->'copilot',f->'planningStatus',f->'maintenancePostId',ctx,coalesce(r.checks,'{}'))::text);
 valid:=not blocked and jsonb_array_length(pending)=0 and coalesce(f->>'planningStatus','confirmed')='confirmed' and not coalesce((f->>'cancelled')::boolean,false)
  and coalesce(jsonb_array_length(r.events),0)=0 and nullif(f->>'actualEngineStart','') is null and nullif(f->>'operationStartedAt','') is null and coalesce(f->>'engineStart','pending')<>'ok'
  and coalesce(f->>'shutdown','pending')<>'ok' and nullif(f->>'actualShutdown','') is null and nullif(f->>'operationEndedAt','') is null;
 return jsonb_build_object('canConfirm',valid,'pending',pending,'blocked',blocked,'fingerprint',fingerprint,'status',
 case when coalesce(jsonb_array_length(r.events),0)>0 or coalesce((f->>'cancelled')::boolean,false) or coalesce(f->>'shutdown','pending')='ok' or nullif(f->>'actualShutdown','') is not null then 'inactive'
 when valid and r.preparation->>'fingerprint'=fingerprint and not coalesce((r.preparation->>'invalidated')::boolean,false) then 'ready'
 when r.preparation ? 'at' then 'reconfirm' else 'pending' end,'actor',r.preparation->>'actor','at',r.preparation->>'at','reason',r.preparation->>'reason');
end $$;
revoke all on function private.preparation_state(text) from public,anon,authenticated;

-- The existing command already handles identity, roles, optimistic concurrency and retries.
do $$ declare f text;anchor text;begin
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into f;
 anchor:=$a$if p_action='reopen' then$a$;
 if strpos(f,anchor)=0 then raise exception 'Operation command changed';end if;
 f:=replace(f,anchor,$b$if p_action='confirm_preparation' then
  if role_name not in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada confirma a preparação';end if;
  entry:=private.preparation_state(p_flight_id);
  if p_payload->>'fingerprint' is distinct from entry->>'fingerprint' then raise exception 'Preparação alterada em outro aparelho. Recarregue e confira';end if;
  if not coalesce((entry->>'canConfirm')::boolean,false) then raise exception 'Confira o voo, as verificações obrigatórias e as pendências técnicas antes de confirmar';end if;
  p_payload:=p_payload||jsonb_build_object('previousPreparation',rec.preparation);
  update public.flight_operation_records set preparation=stamp||jsonb_build_object('fingerprint',entry->>'fingerprint') where flight_id=p_flight_id;
 elsif p_action='reopen' then$b$);
 execute f;
 select pg_get_functiondef('public.get_flight_operation(text)'::regprocedure) into f;
 f:=replace(f,$a$'counterSource',md5$a$,$b$'preparation',private.preparation_state(p_flight_id),'counterSource',md5$b$);execute f;
end $$;

create function public.get_preparation_statuses(p_ids text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;states jsonb:='{}';v jsonb;begin
 if auth.uid() is null then raise exception 'Sessão obrigatória';end if;
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Consulte até 100 voos por vez';end if;
 foreach k in array coalesce(p_ids,array[]::text[]) loop
  begin v:=private.preparation_state(k);states:=states||jsonb_build_object(k,v-'fingerprint');
  exception when raise_exception then null;end;
 end loop;return states;
end $$;
revoke all on function public.get_preparation_statuses(text[]) from public,anon;
grant execute on function public.get_preparation_statuses(text[]) to authenticated;

-- Revocation is persistent: restoring old values must never resurrect a previous OK.
create function private.invalidate_preparation() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb;o jsonb;k text;changed boolean;begin
 if tg_table_name='shared_app_state' then
  for o in select value from jsonb_array_elements(old.flights) loop
   select value into n from jsonb_array_elements(new.flights) where value->>'id'=o->>'id';changed:=n is null;
   foreach k in array array['prefix','model','base','date','departure','destination','spot','fuelAmount','fuelUnit','commander','copilot','planningStatus','cancelled','deletedAt','maintenancePostId','operationStartedAt','engineStart','shutdown'] loop
    changed:=changed or n->k is distinct from o->k;
   end loop;
   if changed then update public.flight_operation_records set preparation=preparation||jsonb_build_object('invalidated',true,'reason','Programação ou operação alterada','invalidatedAt',clock_timestamp()) where (flight_id=o->>'id' or flight_id in(select value->>'id' from jsonb_array_elements(new.flights) where value->>'prefix' in(o->>'prefix',n->>'prefix'))) and preparation ? 'at' and not coalesce((preparation->>'invalidated')::boolean,false);end if;
  end loop;
  for n in select value from jsonb_array_elements(new.flights) where not exists(select 1 from jsonb_array_elements(old.flights) x where x->>'id'=value->>'id') loop
   update public.flight_operation_records set preparation=preparation||jsonb_build_object('invalidated',true,'reason','Novo voo na sequência: conferir preparação','invalidatedAt',clock_timestamp()) where flight_id in(select value->>'id' from jsonb_array_elements(new.flights) where value->>'prefix'=n->>'prefix') and preparation ? 'at' and not coalesce((preparation->>'invalidated')::boolean,false);
  end loop;
 elsif tg_table_name='maintenance_records' then
  for n in select value from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix' in(new.prefix,case when tg_op='UPDATE' then old.prefix else new.prefix end) loop
   update public.flight_operation_records set preparation=preparation||jsonb_build_object('invalidated',true,'reason','Registro técnico alterado: conferir novamente','invalidatedAt',clock_timestamp()) where flight_id=n->>'id' and preparation ? 'at' and not coalesce((preparation->>'invalidated')::boolean,false);
  end loop;
 elsif new.checks is distinct from old.checks then
  new.preparation:=new.preparation||jsonb_build_object('invalidated',true,'reason','Verificações alteradas','invalidatedAt',clock_timestamp());return new;
 end if;return new;
end $$;
revoke all on function private.invalidate_preparation() from public,anon,authenticated;
create trigger preparation_plan_changed after update of flights on public.shared_app_state for each row execute function private.invalidate_preparation();
create trigger preparation_technical_changed after insert or update on public.maintenance_records for each row execute function private.invalidate_preparation();
create trigger preparation_checks_changed before update of checks on public.flight_operation_records for each row execute function private.invalidate_preparation();
