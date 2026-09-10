-- Capture authenticated wash confirmations prospectively. Do not invent historical events.
create table public.runway_wash_events (
 id uuid primary key default gen_random_uuid(), handover_id text not null,
 prefix text not null, model text not null, base text not null,
 wash_key text not null check(wash_key in ('compressorWash','ctDiskWash','productWash')),
 actor text not null, occurred_at timestamptz not null default clock_timestamp(),
 drying_task_id uuid, drying_cycle_at timestamptz
);
create index runway_wash_events_base_time on public.runway_wash_events(base,occurred_at desc,id);
create index runway_wash_events_prefix_time on public.runway_wash_events(prefix,occurred_at desc);
alter table public.runway_wash_events enable row level security;
revoke all on public.runway_wash_events from public,anon,authenticated;
create table private.assistant_data_coverage(dataset text primary key,starts_at timestamptz not null);
alter table private.assistant_data_coverage enable row level security;
insert into private.assistant_data_coverage values('wash_history',clock_timestamp());
revoke all on private.assistant_data_coverage from public,anon,authenticated;

create function private.capture_runway_wash_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare employee text;k text;task public.compressor_drying_tasks;
begin
 select u.employee_number into employee from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if employee is null then return new;end if;
 foreach k in array array['compressorWash','ctDiskWash','productWash'] loop
  if new.checks->>k='yes' and (tg_op='INSERT' or old.checks->>k is distinct from 'yes') then
   select * into task from public.compressor_drying_tasks where prefix=new.prefix and base=new.base and status='pending' and (new.id=any(handover_ids) or source_type='runway_handover' and source_id=new.id) order by triggered_at desc limit 1;
   insert into public.runway_wash_events(handover_id,prefix,model,base,wash_key,actor,drying_task_id,drying_cycle_at)
   values(new.id,new.prefix,new.model,new.base,k,employee,task.id,task.triggered_at);
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.capture_runway_wash_event() from public,anon,authenticated;
-- PostgreSQL orders same-kind triggers by name; capture after existing queue synchronization.
create trigger zz_assistant_capture_runway_wash after insert or update of checks on public.runway_handovers for each row execute function private.capture_runway_wash_event();

create function public.assistant_wash_read(p_employee text,p_from date default null,p_until date default null,p_timezone text default 'America/Sao_Paulo',p_base text default null,p_prefix text default null,p_model text default null,p_status text default 'all',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare employee text;role_name text;actor_base text;is_global boolean;is_crew boolean;from_at timestamptz;until_at timestamptz;coverage timestamptz;rows jsonb;row_count integer;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile),u.assigned_base into employee,role_name,actor_base from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if employee is null or employee is distinct from p_employee then raise exception 'Identidade indisponível';end if;
 is_global:=role_name in('admin','app_manager','maintenance_director','maintenance_manager');
 is_crew:=role_name in('commander','copilot','flight_attendant');
 if role_name is null or not is_global and not is_crew and role_name not in('mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector','leader_inspector','dispatch') then raise exception 'Perfil indisponível';end if;
 if is_crew then actor_base:=private.current_crew_base();end if;
 if not is_global and nullif(trim(actor_base),'') is null then raise exception 'Base indisponível';end if;
 if not is_global and p_base is not null and p_base<>actor_base then raise exception 'Base indisponível';end if;
 if p_offset is null or p_status is null or p_offset<0 or p_offset>5000 or p_status not in('all','open','closed') or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Filtro inválido';end if;
 from_at:=coalesce(p_from,(now() at time zone p_timezone)::date)::timestamp at time zone p_timezone;
 until_at:=(coalesce(p_until,p_from,(now() at time zone p_timezone)::date)+1)::timestamp at time zone p_timezone;
 if until_at<=from_at then raise exception 'Período inválido';end if;
 select starts_at into coverage from private.assistant_data_coverage where dataset='wash_history';
 with eligible as (
  select e.*,d.id pending_id from public.runway_wash_events e
  left join public.compressor_drying_tasks d on d.id=e.drying_task_id and d.triggered_at=e.drying_cycle_at and d.status='pending'
  where e.occurred_at>=from_at and e.occurred_at<until_at
  and (is_global and (p_base is null or e.base=p_base) or not is_global and e.base=actor_base)
  and (not is_crew or private.current_aircraft_base(e.prefix)=actor_base)
  and (p_prefix is null or regexp_replace(lower(e.prefix),'[^a-z0-9]','','g') like '%'||regexp_replace(lower(p_prefix),'[^a-z0-9]','','g')||'%')
  and (p_model is null or regexp_replace(lower(e.model),'[^a-z0-9]','','g') like '%'||regexp_replace(lower(p_model),'[^a-z0-9]','','g')||'%')
  and (p_status='all' or p_status='open' and d.id is not null or p_status='closed' and d.id is null)
  order by e.occurred_at desc,e.id offset p_offset limit 31
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'handoverId',handover_id,'prefix',prefix,'model',model,'base',base,'washType',wash_key,'at',occurred_at,'dryingPending',pending_id is not null,'dryingTaskId',pending_id) order by occurred_at desc,id),'[]'),count(*) into rows,row_count from eligible;
 return jsonb_build_object('status','available','items',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(rows) with ordinality t(value,n) where n<=30),'complete',row_count<=30 and from_at>=coverage,'nextOffset',case when row_count>30 then p_offset+30 end,'coverageStartsAt',coverage,'scope',case when is_global then coalesce(p_base,'Bases autorizadas') else actor_base end,'notice','Confirmações autenticadas registradas desde coverageStartsAt. Não há histórico anterior completo. dryingPending refere-se à pendência do mesmo ciclo de lavagem; ausência de pendência não comprova, isoladamente, execução de secagem.');
end $$;
revoke all on function public.assistant_wash_read(text,date,date,text,text,text,text,text,integer) from public,anon;
grant execute on function public.assistant_wash_read(text,date,date,text,text,text,text,text,integer) to authenticated;
