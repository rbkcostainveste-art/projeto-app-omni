-- Coordination has the same cross-base wash queue access as assistantDryingContext.
create or replace function public.assistant_wash_read(p_employee text,p_from date default null,p_until date default null,p_timezone text default 'America/Sao_Paulo',p_base text default null,p_prefix text default null,p_model text default null,p_status text default 'all',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare employee text;role_name text;actor_base text;is_global boolean;is_crew boolean;from_at timestamptz;until_at timestamptz;coverage timestamptz;rows jsonb;row_count integer;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile),u.assigned_base into employee,role_name,actor_base from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if employee is null or employee is distinct from p_employee then raise exception 'Identidade indisponível';end if;
 is_global:=role_name in('admin','app_manager','coordination','maintenance_director','maintenance_manager');
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

