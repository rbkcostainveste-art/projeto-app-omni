-- Local operational records; no EDB transport or official cycle calculation yet.
create table public.flight_operation_records (
 flight_id text primary key, events jsonb not null default '[]', checks jsonb not null default '{}',
 audit jsonb not null default '[]', revision integer not null default 0, updated_at timestamptz not null default now()
);
alter table public.flight_operation_records enable row level security;
revoke all on public.flight_operation_records from anon,authenticated;

create function private.operation_flight(p_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; u public.authorized_users; d public.device_identities; r text;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into u from public.authorized_users where employee_number=d.employee_number and active;
 if u.id is null then raise exception 'Usuário não autorizado'; end if;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=p_id;
 if f is null or nullif(f->>'deletedAt','') is not null then raise exception 'Voo indisponível'; end if;
 r:=coalesce(u.job_role,u.access_profile);
 if r in ('commander','copilot','flight_attendant') then
  if u.employee_number not in (coalesce(f->>'commander',''),coalesce(f->>'copilot',''),coalesce(f->>'flightAttendant','')) then raise exception 'Voo fora da sua escala'; end if;
 elsif r not in ('admin','app_manager','legacy','coordination','dispatch','maintenance_director','maintenance_manager') and nullif(u.assigned_base,'') is not null and u.assigned_base<>f->>'base' then raise exception 'Voo fora da sua base'; end if;
 return f;
end $$;

create function private.operation_context(p_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; previous_id text; started timestamptz; day text; old_start timestamptz;
begin
 f:=private.operation_flight(p_id);
 select (events->0->>'at')::timestamptz into started from public.flight_operation_records where flight_id=p_id;
 if started is null and nullif(f->>'actualEngineStart','') is not null then started:=(f->>'date'||'T'||(f->>'actualEngineStart')||':00-03:00')::timestamptz; end if;
 day:=coalesce(to_char(started at time zone 'America/Sao_Paulo','YYYY-MM-DD'),f->>'date');
 select x.id into previous_id from (
  select value->>'id' id,coalesce((r.events->0->>'at')::timestamptz,
   case when nullif(value->>'actualEngineStart','') is not null then (value->>'date'||'T'||(value->>'actualEngineStart')||':00-03:00')::timestamptz
   when value->>'engineStart'='ok' or value->>'shutdown'='ok' then (value->>'date'||'T'||(value->>'departure')||':00-03:00')::timestamptz end) as at
  from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) value
  left join public.flight_operation_records r on r.flight_id=value->>'id'
  where s.id='main' and value->>'prefix'=f->>'prefix' and value->>'id'<>p_id and nullif(value->>'deletedAt','') is null
 ) x where to_char(x.at at time zone 'America/Sao_Paulo','YYYY-MM-DD')=day and x.at<coalesce(started,now()) order by x.at desc,x.id desc limit 1;
 return jsonb_build_object('first',previous_id is null,'previousFlightId',previous_id,'day',day);
end $$;

create function public.get_flight_operation(p_flight_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; d public.device_identities; u public.authorized_users; r text; rec public.flight_operation_records;
begin
 f:=private.operation_flight(p_flight_id);
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into u from public.authorized_users where employee_number=d.employee_number and active;
 r:=coalesce(u.job_role,u.access_profile);
 select * into rec from public.flight_operation_records where flight_id=p_flight_id;
 return private.operation_context(p_flight_id)||jsonb_build_object('events',coalesce(rec.events,'[]'),'checks',coalesce(rec.checks,'{}'),'revision',coalesce(rec.revision,0),
 'canPilot',r in ('commander','copilot') and u.employee_number in (coalesce(f->>'commander',''),coalesce(f->>'copilot','')),
 'canSign',r in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'),
 'canExecute',r='maintenance_assistant','closed',coalesce(f->>'shutdown'='ok',false) or nullif(f->>'actualShutdown','') is not null);
end $$;

create function private.validate_operation_events(p_events jsonb,p_model text) returns void language plpgsql set search_path='' as $$
declare e jsonb; t text; prev timestamptz; at timestamptz; apu boolean:=false; e1 boolean:=false; e2 boolean:=false; flying boolean:=false; finished boolean:=false;
begin
 for e in select value from jsonb_array_elements(p_events) loop
  t:=e->>'type';at:=(e->>'at')::timestamptz;
  if at is null or at>now()+interval '1 minute' or (prev is not null and at<prev) or finished then raise exception 'Horário ou sequência de eventos inválida'; end if;
  if t like 'apu_%' and regexp_replace(upper(p_model),'[^A-Z0-9]','','g') not like '%S92%' then raise exception 'APU não habilitada para este modelo'; end if;
  case t
   when 'apu_on' then if apu then raise exception 'APU já acionada'; end if;apu:=true;
   when 'apu_off' then if not apu then raise exception 'APU não acionada'; end if;apu:=false;
   when 'engine1_on' then if e1 then raise exception 'Motor 1 já acionado'; end if;e1:=true;
   when 'engine2_on' then if e2 then raise exception 'Motor 2 já acionado'; end if;e2:=true;
   when 'engine1_off' then if not e1 or flying then raise exception 'Corte incompatível com o estado registrado'; end if;e1:=false;
   when 'engine2_off' then if not e2 or flying then raise exception 'Corte incompatível com o estado registrado'; end if;e2:=false;
   when 'takeoff' then if flying or not e1 or not e2 then raise exception 'Registre o acionamento dos motores antes da decolagem'; end if;flying:=true;
   when 'landing' then if not flying then raise exception 'Registre a decolagem antes do pouso'; end if;flying:=false;
   when 'rotor_brake' then if flying then raise exception 'Aeronave registrada em voo'; end if;
   when 'finish' then if apu or e1 or e2 or flying or prev is null then raise exception 'Registre o pouso e os cortes antes de encerrar'; end if;finished:=true;
   else raise exception 'Evento inválido';
  end case;
  prev:=at;
 end loop;
end $$;

create function public.record_flight_operation(p_flight_id text,p_request_id uuid,p_revision integer,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; ctx jsonb; rec public.flight_operation_records; d public.device_identities; u public.authorized_users; role_name text; ev jsonb; entry jsonb; target text; kind text; key text; at timestamptz; stamp jsonb; patch jsonb:='{}'; typ text; idx integer; first_at timestamptz; takeoff_at timestamptz; cut_at timestamptz;
begin
 -- Serializes first-operation selection, requests and shared-state changes together.
 perform 1 from public.shared_app_state where id='main' for update;
 f:=private.operation_flight(p_flight_id);
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into u from public.authorized_users where employee_number=d.employee_number and active;
 role_name:=coalesce(u.job_role,u.access_profile);
 insert into public.flight_operation_records(flight_id) values(p_flight_id) on conflict do nothing;
 select * into rec from public.flight_operation_records where flight_id=p_flight_id for update;
 if exists(select 1 from jsonb_array_elements(rec.audit) where value->>'requestId'=p_request_id::text) then return public.get_flight_operation(p_flight_id); end if;
 if rec.revision<>p_revision then raise exception 'Registro atualizado por outro operador. Recarregue e confira antes de repetir'; end if;
 if f->>'cancelled'='true' or f->>'planningStatus'='planned' then raise exception 'Confirme o voo antes de registrar a operação'; end if;
 ctx:=private.operation_context(p_flight_id);
 stamp:=jsonb_build_object('actor',u.employee_number,'at',now());
 if p_action in ('event','correct') then
  if role_name not in ('commander','copilot') or u.employee_number not in (coalesce(f->>'commander',''),coalesce(f->>'copilot','')) then raise exception 'Somente piloto escalado registra eventos'; end if;
  at:=coalesce((p_payload->>'at')::timestamptz,now());
  if p_action='event' then
   if f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null then raise exception 'Operação encerrada'; end if;
   typ:=p_payload->>'type';
   if jsonb_array_length(rec.events)=0 and to_char(at at time zone 'America/Sao_Paulo','YYYY-MM-DD')<>f->>'date' then raise exception 'O primeiro evento deve pertencer à data deste voo'; end if;
   rec.events:=rec.events||jsonb_build_array(jsonb_build_object('id',p_request_id,'type',typ,'at',at,'recordedAt',now(),'actor',u.employee_number));
  else
   select ordinality::integer-1,value into idx,ev from jsonb_array_elements(rec.events) with ordinality where value->>'id'=p_payload->>'id';
   if ev is null then raise exception 'Evento não encontrado'; end if;
   if idx=0 and to_char(at at time zone 'America/Sao_Paulo','YYYY-MM-DD')<>to_char((ev->>'at')::timestamptz at time zone 'America/Sao_Paulo','YYYY-MM-DD') then raise exception 'A correção não pode trocar o dia operacional'; end if;
   ev:=ev||jsonb_build_object('at',at,'corrections',coalesce(ev->'corrections','[]')||jsonb_build_array(jsonb_build_object('at',ev->>'at','actor',u.employee_number,'recordedAt',now())));
   rec.events:=jsonb_set(rec.events,array[idx::text],ev);
  end if;
  perform private.validate_operation_events(rec.events,f->>'model');
  patch:=patch||jsonb_build_object('operationStartedAt',rec.events->0->>'at');
  select (value->>'at')::timestamptz into takeoff_at from jsonb_array_elements(rec.events) where value->>'type'='takeoff' order by (value->>'at')::timestamptz limit 1;
  if takeoff_at is not null then patch:=patch||jsonb_build_object('engineStart','ok','actualEngineStart',to_char(takeoff_at at time zone 'America/Sao_Paulo','HH24:MI')); end if;
  if exists(select 1 from jsonb_array_elements(rec.events) where value->>'type'='finish') then
   select max((value->>'at')::timestamptz) into cut_at from jsonb_array_elements(rec.events) where value->>'type' in ('engine1_off','engine2_off');
   cut_at:=coalesce(cut_at,(rec.events->-1->>'at')::timestamptz);
   patch:=patch||jsonb_build_object('shutdown','ok','actualShutdown',to_char(cut_at at time zone 'America/Sao_Paulo','HH24:MI'),'completedAt',cut_at,'operationEndedAt',rec.events->-1->>'at');
  end if;
 elsif p_action in ('execute','approve') then
  key:=p_payload->>'key';
  if key not in ('drain','fuel','inspection','hums','postflight') then raise exception 'Verificação inválida'; end if;
  if key='drain' and not (ctx->>'first')::boolean then raise exception 'Dreno apenas na primeira operação do dia'; end if;
  if key='postflight' and not (f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null) then raise exception 'Encerre a operação antes de registrar a inspeção'; end if;
  target:=case when key='inspection' and not (ctx->>'first')::boolean then ctx->>'previousFlightId' else p_flight_id end;
  kind:=case when key='inspection' then case when (ctx->>'first')::boolean then 'preflight' else 'between' end else key end;
  entry:=coalesce(rec.checks->key,'{}');
  if entry->>'targetFlightId' is distinct from target or entry->>'kind' is distinct from kind then entry:='{}'; end if;
  entry:=entry||jsonb_build_object('kind',kind,'targetFlightId',target);
  if p_action='execute' then
   if role_name<>'maintenance_assistant' or key not in ('drain','hums') then raise exception 'Auxiliar executa somente dreno e HUMS, sem assinatura'; end if;
   if entry?'approval' then raise exception 'Verificação já conferida pela manutenção'; end if;
   entry:=entry||jsonb_build_object('execution',stamp);
  else
   if role_name not in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada assina'; end if;
   if p_payload->>'result' not in ('ok','no') or p_payload->>'result' is null then raise exception 'Resultado inválido'; end if;
   entry:=entry||jsonb_build_object('approval',stamp||jsonb_build_object('result',p_payload->>'result'));
   if key in ('fuel','hums','inspection') then patch:=patch||jsonb_build_object(case when key='inspection' then 'preflight' else key end,p_payload->>'result'); end if;
  end if;
  rec.checks:=jsonb_set(rec.checks,array[key],entry,true);
 else raise exception 'Ação inválida'; end if;
 rec.audit:=rec.audit||jsonb_build_array(jsonb_build_object('requestId',p_request_id,'action',p_action,'payload',p_payload,'actor',u.employee_number,'recordedAt',now()));
 update public.flight_operation_records set events=rec.events,checks=rec.checks,audit=rec.audit,revision=revision+1,updated_at=now() where flight_id=p_flight_id;
 perform public.mutate_shared_item('flights',p_flight_id,patch,'update',array['operationLog'],jsonb_build_object('field','operationLog','value',p_action||' · '||coalesce(p_payload->>'type',p_payload->>'key',p_payload->>'id'),'employeeNumber',u.employee_number,'at',now()),false);
 return public.get_flight_operation(p_flight_id);
end $$;

-- Legacy clients cannot sign by using the former shared checklist path.
create function private.guard_flight_check_signers() returns trigger language plpgsql security definer set search_path='' as $$
declare role_name text; employee text; n jsonb; o jsonb; k text;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile) into employee,role_name from public.device_identities d join public.authorized_users u on u.employee_number=d.employee_number and u.active where d.auth_user_id=auth.uid();
 for n in select value from jsonb_array_elements(new.flights) loop
  select value into o from jsonb_array_elements(old.flights) where value->>'id'=n->>'id';
  foreach k in array array['fuel','preflight','hums'] loop
   if (o is not null and n->k is distinct from o->k) or (o is null and coalesce(n->>k,'pending')<>'pending') then
    if role_name is null or role_name not in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada confirma verificações'; end if;
   end if;
  end loop;
 end loop;
 return new;
end $$;
create trigger guard_flight_check_signers before update on public.shared_app_state for each row execute function private.guard_flight_check_signers();

revoke all on function private.operation_flight(text),private.operation_context(text),private.validate_operation_events(jsonb,text),private.guard_flight_check_signers() from public,anon,authenticated;
revoke all on function public.get_flight_operation(text),public.record_flight_operation(text,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.get_flight_operation(text),public.record_flight_operation(text,uuid,integer,text,jsonb) to authenticated;
notify pgrst,'reload schema';
