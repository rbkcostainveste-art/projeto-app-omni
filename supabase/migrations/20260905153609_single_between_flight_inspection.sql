do $$
declare definition text;
begin
 select pg_get_functiondef('private.operation_context(text)'::regprocedure) into definition;
 definition:=replace(definition,'previous_id text;','previous_id text; next_id text;');
 definition:=replace(definition,$old$ return jsonb_build_object('first',previous_id is null,'previousFlightId',previous_id,'day',day);$old$,$new$
 select x.value->>'id' into next_id
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) x(value)
 left join public.flight_operation_records r on r.flight_id=x.value->>'id'
 where s.id='main' and x.value->>'prefix'=f->>'prefix' and x.value->>'id'<>p_id
 and nullif(x.value->>'deletedAt','') is null and coalesce(x.value->>'cancelled','false')<>'true'
 and coalesce(to_char((r.events->0->>'at')::timestamptz at time zone 'America/Sao_Paulo','YYYY-MM-DD'),x.value->>'date')=day
 and case when r.events->0->>'at' is not null then
   (r.events->0->>'at')::timestamptz>coalesce(started,(f->>'date'||'T'||coalesce(f->>'departure','00:00')||':00-03:00')::timestamptz)
 else coalesce(x.value->>'departure','00:00')>coalesce(f->>'departure','00:00') end
 order by coalesce(r.events->0->>'at',x.value->>'date'||'T'||x.value->>'departure'),x.value->>'id' limit 1;
 return jsonb_build_object('first',previous_id is null,'previousFlightId',previous_id,'nextFlightId',next_id,'day',day);
$new$);
 if position('nextFlightId' in definition)=0 then raise exception 'Context replacement failed'; end if;
 execute definition;
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$  target:=case when key='inspection'$old$,$new$  if key='postflight' and ctx->>'nextFlightId' is not null then raise exception 'Assine Entre voos no próximo voo. Essa assinatura também registra a inspeção após este voo.'; end if;
  target:=case when key='inspection'$new$);
 if position('Assine Entre voos' in definition)=0 then raise exception 'Guard replacement failed'; end if;
 execute definition;
end $$;
notify pgrst,'reload schema';
