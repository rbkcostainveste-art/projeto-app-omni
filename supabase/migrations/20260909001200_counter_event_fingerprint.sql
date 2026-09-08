-- A maintenance approval alone must not mark event-derived counters outdated.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.get_flight_operation(text)'::regprocedure) into definition;
 definition:=replace(definition,$old$'counters',private.flight_counter_values$old$,$new$'counterSource',md5(coalesce(rec.events,'[]')::text),'counters',private.flight_counter_values$new$);
 execute definition;
 select pg_get_functiondef('public.cockpit(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$'sourceCapturedAt',now(),'current'$old$,$new$'sourceCapturedAt',now(),'sourceFingerprint',(select md5(events::text) from public.flight_operation_records where flight_id=fid),'current'$new$);
 if position('sourceFingerprint' in definition)=0 then raise exception 'Source fingerprint patch not applied';end if;
 execute definition;
end $$;
