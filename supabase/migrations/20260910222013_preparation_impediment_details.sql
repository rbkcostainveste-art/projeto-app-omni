-- Read-only status enrichment. Existing confirmation and blocking rules stay intact.
create or replace function private.preparation_state(p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 f jsonb:=private.operation_flight(p_id);ctx jsonb:=private.operation_context(p_id);
 r public.flight_operation_records;k text;keys text[];pending jsonb:='[]';fingerprint text;
 blocked boolean;valid boolean;blocker_count integer;blockers jsonb;
begin
 select * into r from public.flight_operation_records where flight_id=p_id;
 keys:=case when nullif(f->>'maintenancePostId','') is not null then array['fuel','inspection'] when (ctx->>'first')::boolean then array['drain','fuel','inspection','hums'] else array['fuel','inspection','hums'] end;
 foreach k in array keys loop
  if r.checks#>>array[k,'approval','result'] is distinct from 'ok'
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
 return jsonb_build_object('canConfirm',valid,'pending',pending,'blocked',blocked,'fingerprint',fingerprint,
 'checklist',jsonb_build_object('total',cardinality(keys),'approved',cardinality(keys)-jsonb_array_length(pending),'first',(ctx->>'first')::boolean),
 'blockers',blockers,'blockerCount',blocker_count,'status',
 case when coalesce(jsonb_array_length(r.events),0)>0 or coalesce((f->>'cancelled')::boolean,false) or coalesce(f->>'shutdown','pending')='ok' or nullif(f->>'actualShutdown','') is not null then 'inactive'
 when valid and r.preparation->>'fingerprint'=fingerprint and not coalesce((r.preparation->>'invalidated')::boolean,false) then 'ready'
 when r.preparation ? 'at' then 'reconfirm' else 'pending' end,'actor',r.preparation->>'actor','at',r.preparation->>'at','reason',r.preparation->>'reason');
end $$;
revoke all on function private.preparation_state(text) from public,anon,authenticated;
