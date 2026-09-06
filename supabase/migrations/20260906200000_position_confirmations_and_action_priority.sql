create table public.flight_position_confirmations (
 flight_id text primary key, spot text not null, confirmed boolean not null default false,
 actor text, actor_name text, marked_at timestamptz, history jsonb not null default '[]'
);
alter table public.flight_position_confirmations enable row level security;
revoke all on public.flight_position_confirmations from public,anon,authenticated;

create function public.get_flight_position(p_flight_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; rec public.flight_position_confirmations;
begin
 f:=private.operation_flight(p_flight_id);
 select * into rec from public.flight_position_confirmations where flight_id=p_flight_id;
 return jsonb_build_object('spot',coalesce(f->>'spot',''),'confirmed',coalesce(rec.spot=coalesce(f->>'spot','') and rec.confirmed,false),'actor',rec.actor,'name',rec.actor_name,'at',rec.marked_at,'history',coalesce(rec.history,'[]'));
end $$;

create function public.mark_flight_position(p_flight_id text,p_spot text,p_confirmed boolean,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; d public.device_identities; actor_name text; stamp jsonb;
begin
 perform 1 from public.shared_app_state where id='main' for update;
 f:=private.operation_flight(p_flight_id);
 if nullif(trim(f->>'spot'),'') is null then raise exception 'Aguardando coordenação informar a posição';end if;
 if p_spot is distinct from f->>'spot' then raise exception 'A posição mudou. Confira a nova posição antes de confirmar';end if;
 if p_confirmed is null or p_request_id is null then raise exception 'Confirmação inválida';end if;
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select display_name into actor_name from public.authorized_users where employee_number=d.employee_number and active;
 if exists(select 1 from public.flight_position_confirmations r,jsonb_array_elements(r.history) h where r.flight_id=p_flight_id and h->>'requestId'=p_request_id::text) then return public.get_flight_position(p_flight_id);end if;
 stamp:=jsonb_build_object('spot',p_spot,'confirmed',p_confirmed,'actor',d.employee_number,'name',actor_name,'at',now(),'requestId',p_request_id);
 insert into public.flight_position_confirmations(flight_id,spot,confirmed,actor,actor_name,marked_at,history) values(p_flight_id,p_spot,p_confirmed,d.employee_number,actor_name,now(),jsonb_build_array(stamp))
 on conflict(flight_id) do update set spot=excluded.spot,confirmed=excluded.confirmed,actor=excluded.actor,actor_name=excluded.actor_name,marked_at=excluded.marked_at,history=flight_position_confirmations.history||excluded.history;
 update public.shared_app_state set revision=revision+1,updated_at=now() where id='main';
 return public.get_flight_position(p_flight_id);
end $$;

create function private.guard_positions_and_priority() returns trigger language plpgsql security definer set search_path='' as $$
declare f jsonb; previous jsonb; d public.device_identities; role_name text; actor_name text; pending boolean;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select job_role,display_name into role_name,actor_name from public.authorized_users where employee_number=d.employee_number and active;
 for f in select value from jsonb_array_elements(new.flights) loop
  select value into previous from jsonb_array_elements(old.flights) where value->>'id'=f->>'id';
  if upper(trim(coalesce(f->>'spot',''))) is distinct from upper(trim(coalesce(previous->>'spot',''))) then
   if auth.uid() is not null and coalesce(role_name,'') not in('coordination','admin','app_manager') then raise exception 'Somente a coordenação define a posição';end if;
   insert into public.flight_position_confirmations(flight_id,spot,history) values(f->>'id',coalesce(f->>'spot',''),jsonb_build_array(jsonb_build_object('spot',coalesce(f->>'spot',''),'confirmed',false,'actor',d.employee_number,'name',actor_name,'at',now(),'reason','Posição alterada pela coordenação')))
   on conflict(flight_id) do update set spot=excluded.spot,confirmed=false,actor=null,actor_name=null,marked_at=null,history=flight_position_confirmations.history||excluded.history;
  end if;
  if previous is not null and auth.uid() is not null and coalesce(role_name,'') not in('coordination','admin','app_manager') and (coalesce(f->>'commander','') is distinct from coalesce(previous->>'commander','') or coalesce(f->>'copilot','') is distinct from coalesce(previous->>'copilot','') or coalesce(f->>'flightAttendant','') is distinct from coalesce(previous->>'flightAttendant','')) then raise exception 'Somente a coordenação define a tripulação';end if;
  if previous is not null and nullif(f->>'maintenancePostId','') is null and nullif(f->>'compressorDryingTaskId','') is null and
   ((f->>'engineStart'='ok' and coalesce(previous->>'engineStart','')<>'ok') or (nullif(f->>'operationStartedAt','') is not null and nullif(previous->>'operationStartedAt','') is null) or (nullif(f->>'actualEngineStart','') is not null and nullif(previous->>'actualEngineStart','') is null)) then
   select exists(select 1 from public.operational_wall_posts p,jsonb_array_elements(coalesce(p.data->'actions','[]')) a where a->>'prefix'=f->>'prefix' and p.data->>'category' in('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') and coalesce(p.data->>'resolved','false')<>'true' and a->>'status' not in('satisfactory','resolved')) into pending;
   if pending then raise exception 'Voo produtivo aguardando conclusão do voo/giro de manutenção desta aeronave';end if;
   if exists(select 1 from jsonb_array_elements(new.catalogs->'aircraft') a where a->>'prefix'=f->>'prefix' and a->>'available'='false') then raise exception 'Aeronave indisponível: aguarde a liberação da manutenção';end if;
  end if;
 end loop;
 return new;
end $$;
create trigger guard_positions_and_priority before update of flights on public.shared_app_state for each row execute function private.guard_positions_and_priority();
revoke all on function private.guard_positions_and_priority() from public,anon,authenticated;
revoke all on function public.get_flight_position(text),public.mark_flight_position(text,text,boolean,uuid) from public,anon;
grant execute on function public.get_flight_position(text),public.mark_flight_position(text,text,boolean,uuid) to authenticated;
