-- Measurements from recorded events, not certified engine life/cycle rules.
create or replace function private.flight_counter_values(events jsonb,model text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'; equipment text; label text; e jsonb; started timestamptz; seconds numeric; starts integer; flying timestamptz; airborne numeric:=0; landings integer:=0; brakes integer:=0;
begin
 foreach equipment in array array['engine1','engine2','apu'] loop
  if equipment='apu' and regexp_replace(upper(model),'[^A-Z0-9]','','g') not like '%S92%' then continue;end if;
  label:=case equipment when 'engine1' then 'Motor 1' when 'engine2' then 'Motor 2' else 'APU' end;
  started:=null;seconds:=0;starts:=0;
  for e in select value from jsonb_array_elements(events) loop
   if e->>'type'=equipment||'_on' then started:=(e->>'at')::timestamptz;starts:=starts+1;end if;
   if e->>'type'=equipment||'_off' and started is not null then seconds:=seconds+greatest(0,extract(epoch from ((e->>'at')::timestamptz-started)));started:=null;end if;
  end loop;
  result:=result||jsonb_build_array(jsonb_build_object('key',equipment||'_minutes','label',label||' · funcionamento','unit','Minutos','value',floor(seconds/60),'inProgress',started is not null),jsonb_build_object('key',equipment||'_starts','label',label||' · acionamentos','unit','Acionamentos','value',starts,'inProgress',false));
 end loop;
 for e in select value from jsonb_array_elements(events) loop
  if e->>'type'='takeoff' then flying:=(e->>'at')::timestamptz;end if;
  if e->>'type'='landing' then landings:=landings+1;if flying is not null then airborne:=airborne+greatest(0,extract(epoch from ((e->>'at')::timestamptz-flying)));flying:=null;end if;end if;
  if e->>'type'='rotor_brake' then brakes:=brakes+1;end if;
 end loop;
 return result||jsonb_build_array(jsonb_build_object('key','airborne_minutes','label','Decolagem a pouso','unit','Minutos','value',floor(airborne/60),'inProgress',flying is not null),jsonb_build_object('key','landings','label','Pousos registrados','unit','Pousos','value',landings,'inProgress',false),jsonb_build_object('key','rotor_brakes','label','Freio rotor · aplicações','unit','Aplicações','value',brakes,'inProgress',false));
end $$;
revoke all on function private.flight_counter_values(jsonb,text) from public,anon,authenticated;

do $$
declare definition text;
begin
 select pg_get_functiondef('private.cockpit_access(text,text,text,text,boolean)'::regprocedure) into definition;
 definition:=replace(definition,$old$if role_name not in ('commander','copilot','flight_attendant','coordination','dispatch') then return false;end if;$old$,
 $new$if k='counter' and fid is not null and role_name in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then
  begin perform private.operation_flight(fid);return true;exception when others then return false;end;
 end if;
 if role_name not in ('commander','copilot','flight_attendant','coordination','dispatch') then return false;end if;$new$);
 if position('perform private.operation_flight(fid)' in definition)=0 then raise exception 'Counter access patch not applied';end if;
 execute definition;

 select pg_get_functiondef('public.get_flight_operation(text)'::regprocedure) into definition;
 definition:=replace(definition,$old$'events',coalesce(rec.events,'[]')$old$,$new$'counters',private.flight_counter_values(coalesce(rec.events,'[]'),f->>'model'),'events',coalesce(rec.events,'[]')$new$);
 if position('private.flight_counter_values' in definition)=0 then raise exception 'Counter read patch not applied';end if;
 execute definition;

 select pg_get_functiondef('public.cockpit(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$if k='counter' then$old$,$new$if k='counter' then
  if nullif(body->>'eventMetric','') is not null then
   perform 1 from public.flight_operation_records where flight_id=fid for share;
   if (select revision from public.flight_operation_records where flight_id=fid) is distinct from (body->>'sourceRevision')::integer then raise exception 'Eventos atualizados. Recarregue os contadores antes de salvar';end if;
   select x into f from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) x where s.id='main' and x->>'id'=fid;
   select x into result from public.flight_operation_records o cross join lateral jsonb_array_elements(private.flight_counter_values(o.events,f->>'model')) x where o.flight_id=fid and x->>'key'=body->>'eventMetric';
   if result is null then raise exception 'Contador não disponível para esta aeronave';end if;
   if (result->>'inProgress')::boolean then raise exception 'Aguarde o encerramento do período para registrar esse tempo';end if;
   body:=body||jsonb_build_object('title',result->>'label','unit',result->>'unit','increment',result->'value','sourceFlightId',fid,'source','Eventos registrados no aplicativo','sourceCapturedAt',now(),'current',case when nullif(body->>'previous','') is not null then (body->>'previous')::numeric+(result->>'value')::numeric else null end);
  end if;$new$);
 definition:=replace(definition,$old$'events',o.events,'checks',o.checks$old$,$new$'counters',private.flight_counter_values(o.events,f->>'model'),'events',o.events,'checks',o.checks$new$);
 if position('sourceCapturedAt' in definition)=0 then raise exception 'Counter save patch not applied';end if;
 execute definition;
end $$;
