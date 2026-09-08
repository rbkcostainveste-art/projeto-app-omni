begin;
-- Tighten the same trigger so older RPCs cannot bypass cross-case release checks.
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'c:=new.technical_case; reason:=', 'perform pg_advisory_xact_lock(hashtextextended(new.prefix,83642)); c:=new.technical_case; reason:=');
 f:=replace(f,'new.technical_case:=c;', $patch$
 if tg_op='UPDATE' then
  for entry in select value from jsonb_array_elements(coalesce(new.data->'entries','[]')) loop
   if not coalesce(old.data->'entries','[]') @> jsonb_build_array(entry) and entry->>'employeeNumber' is distinct from a->>'employee' then raise exception 'A autoria da nova entrada deve corresponder à sessão';end if;
  end loop;
 end if;
 if c->>'aircraft' in('released','deferred','monitoring') and (tg_op='INSERT' or c is distinct from o) and exists(
  select 1 from public.maintenance_records other where other.prefix=new.prefix and other.id<>new.id and other.record_type<>'inspection'
  and (coalesce((other.technical_case->>'critical')::boolean,false) or other.technical_case->>'investigation'='test_failed'
    or (other.technical_case->>'report' in('discrepancy','recurrence')
      and not (coalesce((other.technical_case->>'officialClosed')::boolean,false) and nullif(other.technical_case->>'aprsRef','') is not null and nullif(other.technical_case->>'aprsBy','') is not null)
      and not coalesce((other.technical_case#>>'{disposition,deadline}')::timestamptz>now() and other.technical_case#>>'{disposition,type}' in('MEL','CDL','procedure') and nullif(other.technical_case#>>'{disposition,authorizedBy}','') is not null,false)))
 ) then raise exception 'Outro caso da aeronave exige disposição formal. Confira os casos ativos antes de registrar liberação';end if;
 new.technical_case:=c;
 $patch$);
 execute f;
 select pg_get_functiondef('public.append_maintenance_media(uuid,jsonb)'::regprocedure) into f;
 f:=replace(f,'''image'',''audio'',''video''','''image'',''audio'',''video'',''document''');execute f;
end $$;
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/pdf') where id='record-media' and not 'application/pdf'=any(allowed_mime_types);

-- Minimal status, with no chat, personal note, technical description or author disclosure.
create function public.technical_aircraft_summary(p_prefix text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); states jsonb;
begin
 if a is null then raise exception 'Sessão necessária';end if;
 select jsonb_build_object('total',count(*),'attention',count(*) filter(where technical_case->>'aircraft' in('evaluation','unavailable','maintenance') or coalesce((technical_case->>'critical')::boolean,false) or technical_case->>'investigation'='test_failed' or (technical_case->>'aircraft'='deferred' and (technical_case#>>'{disposition,deadline}')::timestamptz<=now())), 'deferred',count(*) filter(where technical_case->>'aircraft'='deferred'),'monitoring',count(*) filter(where technical_case->>'aircraft'='monitoring')) into states
 from public.maintenance_records where prefix=p_prefix and record_type<>'inspection' and technical_case->>'investigation'<>'closed';
 return states;
end $$;
revoke all on function public.technical_aircraft_summary(text) from public,anon;
grant execute on function public.technical_aircraft_summary(text) to authenticated;
commit;
