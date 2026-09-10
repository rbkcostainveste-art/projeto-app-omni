-- Readiness is derived from the applicable signed checks; no extra final signature.
create or replace function private.preparation_state(p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 f jsonb:=private.operation_flight(p_id);ctx jsonb:=private.operation_context(p_id);
 r public.flight_operation_records;k text;keys text[];pending jsonb:='[]';fingerprint text;
 blocked boolean;valid boolean;blocker_count integer;blockers jsonb;last_approval jsonb;
begin
 select * into r from public.flight_operation_records where flight_id=p_id;
 keys:=case when nullif(f->>'maintenancePostId','') is not null then array['fuel','inspection'] when (ctx->>'first')::boolean then array['drain','fuel','inspection','hums'] else array['fuel','inspection','hums'] end;
 foreach k in array keys loop
  if r.checks#>>array[k,'approval','result'] is distinct from 'ok'
   or coalesce((r.checks#>>array[k,'approval','invalidated'])::boolean,false)
   or r.checks#>>array[k,'targetFlightId'] is distinct from (case when k='inspection' and not (ctx->>'first')::boolean then ctx->>'previousFlightId' else p_id end)
   or r.checks#>>array[k,'kind'] is distinct from (case when k='inspection' then case when (ctx->>'first')::boolean then 'preflight' else 'between' end else k end)
  then pending:=pending||to_jsonb(k);end if;
 end loop;

 -- Reasons are operational summaries for authorized flight viewers. Titles/codes
 -- follow the existing maintenance_records SELECT policy, including its base scope.
 with candidates as (
  select m.id,m.title,m.ticket_code,m.created_at,
   array_remove(array[
    case when m.technical_case->>'aircraft'='evaluation' then 'evaluation' end,
    case when m.technical_case->>'aircraft'='unavailable' then 'unavailable' end,
    case when m.technical_case->>'aircraft'='maintenance' then 'maintenance' end,
    case when coalesce((m.technical_case->>'critical')::boolean,false) then 'critical' end,
    case when m.technical_case->>'investigation'='test_failed' then 'test_failed' end,
    case when m.technical_case->>'report' in('discrepancy','recurrence') and not coalesce(private.technical_valid_disposition(m.technical_case),false) then 'disposition_pending' end,
    case when m.technical_case->>'aircraft'='deferred' and nullif(m.technical_case#>>'{disposition,deadline}','')::timestamptz<=now() then 'deferral_expired' end
   ],null) reasons,
   exists(select 1 from public.device_identities d where d.auth_user_id=auth.uid()
    and (d.is_admin or d.access_profile in('legacy','mechanic','leader_inspector'))
    and (d.assigned_base is null or d.access_profile in('legacy','leader_inspector') or d.assigned_base=m.base)) readable
  from public.maintenance_records m
  where m.prefix=f->>'prefix' and m.record_type<>'inspection' and m.status<>'closed'
 ), ranked as (
  select *,row_number() over(order by created_at desc,id) ordinal from candidates where cardinality(reasons)>0
 )
 select count(*),coalesce(jsonb_agg(jsonb_build_object('reasons',reasons)||
  case when readable then jsonb_strip_nulls(jsonb_build_object('title',left(title,140),'ticketCode',ticket_code)) else '{}'::jsonb end
  order by ordinal) filter(where ordinal<=5),'[]'::jsonb)
 into blocker_count,blockers from ranked;
 blocked:=blocker_count>0;

 fingerprint:=md5(jsonb_build_array(f->'prefix',f->'date',f->'base',f->'model',f->'fuelAmount',f->'fuelUnit',f->'destination',f->'departure',f->'spot',f->'commander',f->'copilot',f->'planningStatus',f->'maintenancePostId',ctx,coalesce(r.checks,'{}'))::text);
 valid:=not blocked and jsonb_array_length(pending)=0 and coalesce(f->>'planningStatus','confirmed')='confirmed' and not coalesce((f->>'cancelled')::boolean,false)
  and coalesce(jsonb_array_length(r.events),0)=0 and nullif(f->>'actualEngineStart','') is null and nullif(f->>'operationStartedAt','') is null and coalesce(f->>'engineStart','pending')<>'ok'
  and coalesce(f->>'shutdown','pending')<>'ok' and nullif(f->>'actualShutdown','') is null and nullif(f->>'operationEndedAt','') is null;
 select value->'approval' into last_approval from jsonb_each(coalesce(r.checks,'{}'))
 where key=any(keys) and value#>>'{approval,result}'='ok'
 and not coalesce((value#>>'{approval,invalidated}')::boolean,false)
 order by (value#>>'{approval,at}')::timestamptz desc,key limit 1;
 return jsonb_build_object('automatic',true,'canConfirm',valid,'pending',pending,'blocked',blocked,'fingerprint',fingerprint,
 'checklist',jsonb_build_object('total',cardinality(keys),'approved',cardinality(keys)-jsonb_array_length(pending),'first',(ctx->>'first')::boolean),
 'blockers',blockers,'blockerCount',blocker_count,'status',
 case when nullif(f->>'actualEngineStart','') is not null or nullif(f->>'operationStartedAt','') is not null or coalesce(f->>'engineStart','pending')='ok' or nullif(f->>'operationEndedAt','') is not null or coalesce(jsonb_array_length(r.events),0)>0 or coalesce((f->>'cancelled')::boolean,false) or coalesce(f->>'shutdown','pending')='ok' or nullif(f->>'actualShutdown','') is not null then 'inactive'
 when valid then 'ready' else 'pending' end,'actor',last_approval->>'actor','at',last_approval->>'at',
 'reason',case when coalesce(f->>'planningStatus','confirmed')<>'confirmed' then 'Voo aguardando confirmação da coordenação' end);
end $$;
revoke all on function private.preparation_state(text) from public,anon,authenticated;

-- Preserve each signed approval and its audit. Only invalidate checks whose
-- physical context changed, instead of requiring another overall confirmation.
create or replace function private.invalidate_preparation() returns trigger
language plpgsql security definer set search_path='' as $$
declare n jsonb;o jsonb;k text;keys text[];reason text;all_changed boolean;
begin
 for o in select value from jsonb_array_elements(old.flights) loop
  select value into n from jsonb_array_elements(new.flights) where value->>'id'=o->>'id';
  if n is null then continue;end if;
  all_changed:=false;
  foreach k in array array['prefix','model','date','maintenancePostId'] loop
   all_changed:=all_changed or n->k is distinct from o->k;
  end loop;
  if all_changed then
   keys:=array['drain','fuel','inspection','hums','postflight'];reason:='Aeronave ou data do voo alterada. Confira este item novamente.';
  elsif n->'fuelAmount' is distinct from o->'fuelAmount' or n->'fuelUnit' is distinct from o->'fuelUnit' then
   keys:=array['fuel'];reason:='Abastecimento alterado. Confira o combustível novamente.';
  else continue;end if;
  update public.flight_operation_records r set
   checks=(select jsonb_object_agg(key,case when key=any(keys) and value ? 'approval' then
    jsonb_set(value,'{approval}',(value->'approval')||jsonb_build_object('invalidated',true,'invalidatedAt',clock_timestamp(),'reason',reason)) else value end)
    from jsonb_each(r.checks)),
   audit=r.audit||jsonb_build_array(jsonb_build_object('action','invalidate_checks','keys',keys,'reason',reason,'recordedAt',clock_timestamp())),
   revision=r.revision+1,updated_at=now()
  where r.flight_id=o->>'id' and exists(select 1 from jsonb_each(r.checks) where key=any(keys) and value ? 'approval')
   and coalesce(jsonb_array_length(r.events),0)=0;
 end loop;
 return new;
end $$;
revoke all on function private.invalidate_preparation() from public,anon,authenticated;
drop trigger if exists preparation_technical_changed on public.maintenance_records;
drop trigger if exists preparation_checks_changed on public.flight_operation_records;

-- Older clients keep their optional confirmation RPC, but readiness never
-- depends on it. A maintenance-flight start must still respect stale checks.
do $$
declare f text;old_guard text:=$a$rec.checks#>>'{fuel,approval,result}' is distinct from 'ok' or rec.checks#>>'{inspection,approval,result}' is distinct from 'ok'$a$;
begin
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into f;
 if position(old_guard in f)=0 then raise exception 'Maintenance check guard not found';end if;
 f:=replace(f,old_guard,old_guard||$b$ or coalesce((rec.checks#>>'{fuel,approval,invalidated}')::boolean,false) or coalesce((rec.checks#>>'{inspection,approval,invalidated}')::boolean,false)$b$);
 execute f;
end $$;
