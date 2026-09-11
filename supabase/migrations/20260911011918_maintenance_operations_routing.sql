-- Report metadata describes the source. It must never replace an activity's category.
create or replace function private.preserve_maintenance_action_category()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if jsonb_array_length(coalesce(old.data->'actions','[]'))>0
 and jsonb_array_length(coalesce(new.data->'actions','[]'))>0
 and old.data->>'category' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT disk','Lavagem da CT Disk','Lavagem com produto','Procedimentos')
 and new.data->>'category' in ('Relato Técnico','Pane','Discrepância','Caso Técnico') then
  new.data:=jsonb_set(new.data,'{category}',old.data->'category');
 end if;
 return new;
end $$;
revoke all on function private.preserve_maintenance_action_category() from public,anon,authenticated;
create trigger preserve_maintenance_action_category before update of data on public.operational_wall_posts
for each row execute function private.preserve_maintenance_action_category();

CREATE OR REPLACE FUNCTION private.sync_maintenance_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb; f jsonb; aircraft jsonb; origin public.maintenance_records; fid text; patch jsonb; card jsonb; finished boolean; stamp text;
begin
 if coalesce(new.data->>'category','') not in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') then return new;end if;
 select * into origin from public.maintenance_records where id=(new.data->>'maintenanceRecordId')::uuid;
 for a in select value from jsonb_array_elements(coalesce(new.data->'actions','[]')) loop
  fid:='maintenance-'||(a->>'id');
  perform 1 from public.shared_app_state where id='main' for update;
  select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=fid;
  patch:=jsonb_build_object('maintenancePostId',new.id,'maintenanceActionId',a->>'id','maintenanceRecordId',origin.id,'maintenancePriority',case when new.data->>'priority'='critical' then 'critical' when origin.priority in ('urgent','logged') or new.data->>'priority'='urgent' then 'urgent' else coalesce(new.data->>'priority','routine') end,'maintenanceCategory',new.data->>'category','maintenancePurpose',a->>'title','maintenanceOriginTitle',coalesce(origin.title,'Atividade de manutenção'),'maintenanceEditedAt',a->>'editedAt','maintenanceCreatedAt',a->>'createdAt');
  if f is null then
   select value into aircraft from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') where s.id='main' and value->>'prefix'=a->>'prefix' limit 1;
   finished:=a->>'status' in ('satisfactory','resolved');stamp:=coalesce(a#>>'{executions,0,at}',a->>'createdAt');
   card:=patch||jsonb_build_object('id',fid,'prefix',a->>'prefix','model',coalesce(aircraft->>'model',origin.model),'base',new.base,'date',to_char((a->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'departure',to_char((a->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo','HH24:MI'),'destination','','duration',0,'fuelAmount',0,'fuelUnit','lb','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown',case when finished then 'ok' else 'pending' end,'operationEndedAt',case when finished then stamp else null end,'planningStatus','planned','commander','','copilot','','flightAttendant','','revision',1,'acknowledged','{}'::jsonb,'createdBy',new.data->>'createdBy','updatedBy',new.data->>'createdBy','history','[]'::jsonb);
   update public.shared_app_state set flights=flights||jsonb_build_array(card),revision=revision+1,updated_at=now() where id='main';
  elsif f||patch<>f then
   update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=fid then value||patch else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';
  end if;
 end loop;
 return new;
end $function$;

-- An explicit coordination assignment publishes the operation to its pilots.
create or replace function public.configure_maintenance_operation(p_post_id text,p_plan jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities; role_name text; f jsonb; p public.operational_wall_posts; patch jsonb:='{}'; candidate jsonb; key text; stamp text:=now()::text;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in ('coordination','admin','app_manager') then raise exception 'Sem permissão para programar a atividade';end if;
 select * into p from public.operational_wall_posts where id=p_post_id;
 if p.id is null then raise exception 'Atividade não encontrada';end if;
 if role_name not in ('admin','app_manager') and p.base is distinct from d.assigned_base then raise exception 'Atividade fora da base';end if;
 perform 1 from public.shared_app_state where id='main' for update;
 if not(p_plan?'flightId') and (select count(*) from public.shared_app_state s,jsonb_array_elements(s.flights) v where s.id='main' and v->>'maintenancePostId'=p_post_id and coalesce(v->>'deletedAt','')='')>1 then raise exception 'Selecione o voo/giro que deseja programar';end if;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights)
 where s.id='main' and value->>'maintenancePostId'=p_post_id and (not(p_plan?'flightId') or value->>'id'=p_plan->>'flightId');
 if f is null or coalesce(f->>'deletedAt','')<>'' or coalesce(f->>'cancelled','false')='true' then raise exception 'Voo/giro não encontrado ou retirado';end if;
 if f->>'shutdown'='ok' or nullif(f->>'operationEndedAt','') is not null then raise exception 'Operação encerrada';end if;
 if p_plan?'expectedRevision' and (p_plan->>'expectedRevision')::int<>coalesce((f->>'revision')::int,0) then raise exception 'A programação foi alterada. Atualize e tente novamente';end if;
 foreach key in array array['date','departure','spot','crewRequirement','commander','copilot'] loop
  if p_plan?key then patch:=patch||jsonb_build_object(key,trim(coalesce(p_plan->>key,'')));end if;
 end loop;
 if patch?'spot' then patch:=jsonb_set(patch,'{spot}',to_jsonb(upper(patch->>'spot')));end if;
 candidate:=f||patch;
 if coalesce(candidate->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida';end if;
 perform (candidate->>'date')::date;
 if coalesce(candidate->>'departure','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido';end if;
 foreach key in array array['commander','copilot'] loop
  if nullif(candidate->>key,'') is not null and not exists(select 1 from public.authorized_users where employee_number=candidate->>key and active and job_role in('commander','copilot')) then raise exception 'Tripulante inválido';end if;
 end loop;
 if nullif(candidate->>'commander','') is not null and candidate->>'commander'=candidate->>'copilot' then raise exception 'Selecione pessoas diferentes para piloto e copiloto';end if;
 if nullif(f->>'operationStartedAt','') is not null or nullif(f->>'actualEngineStart','') is not null or f->>'engineStart'='ok' then
  if exists(select 1 from unnest(array['date','departure','commander','copilot']) k where candidate->>k is distinct from f->>k) then raise exception 'Operação iniciada: mantenha data, horário e tripulação';end if;
 end if;
 patch:=patch||jsonb_build_object('planningStatus',case when nullif(candidate->>'commander','') is not null or nullif(candidate->>'copilot','') is not null then 'confirmed' else 'planned' end,'maintenancePlannedBy',d.employee_number,'maintenancePlannedAt',stamp,'updatedBy',d.employee_number,'revision',coalesce((f->>'revision')::int,0)+1,
 'history',coalesce(f->'history','[]')||jsonb_build_array(jsonb_build_object('field','maintenancePlan','value','Programação atualizada','employeeNumber',d.employee_number,'at',stamp,'before',jsonb_build_object('date',f->>'date','departure',f->>'departure','commander',f->>'commander','copilot',f->>'copilot'),'after',patch)));
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=f->>'id' then value||patch else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';
end $$;
revoke all on function public.configure_maintenance_operation(text,jsonb) from public,anon;
grant execute on function public.configure_maintenance_operation(text,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.list_maintenance_operation_cards()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',f->>'maintenanceActionId','postId',f->>'maintenancePostId','flightId',f->>'id','prefix',f->>'prefix','model',f->>'model','base',f->>'base','title',f->>'maintenancePurpose','description',f->>'maintenanceOriginTitle','category',f->>'maintenanceCategory','planningStatus',f->>'planningStatus','priority',f->>'maintenancePriority','revision',f->'revision','spot',f->>'spot','crewRequirement',f->>'crewRequirement','commander',f->>'commander','copilot',f->>'copilot','date',f->>'date','departure',f->>'departure','editedAt',f->>'maintenanceEditedAt','createdAt',(f->>'date')||'T'||(f->>'departure')||':00-03:00','status',case when f->>'shutdown'='ok' then 'completed' else 'pending' end)
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f
 join public.device_identities d on d.auth_user_id=(select auth.uid()) join public.authorized_users u on u.employee_number=d.employee_number and u.active
 where s.id='main' and f->>'maintenanceCategory' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') and f->>'maintenancePostId' is not null and coalesce(f->>'deletedAt','')='' and coalesce(f->>'cancelled','false')<>'true'
 and (u.job_role in ('admin','app_manager','maintenance_director','maintenance_manager') or u.job_role in ('commander','copilot') or f->>'base'=d.assigned_base)
 and (u.job_role in ('admin','app_manager','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant') or u.job_role in ('commander','copilot') and coalesce(f->>'planningStatus','confirmed')='confirmed' and u.employee_number in(f->>'commander',f->>'copilot'));
$function$
;

CREATE OR REPLACE FUNCTION public.list_crew_maintenance_actions()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select card from public.list_maintenance_operation_cards() card
 where exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and u.job_role in('commander','copilot'))
 and (card->>'status'='pending' or card->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
 union all
 select jsonb_build_object('id',a->>'id','postId',p.id,'flightId',f->>'id','date',f->>'date','prefix',a->>'prefix','category',case when lower(p.data->>'category')='lavagem da ct disk' then 'Lavagem da CT disk' else p.data->>'category' end,'title',a->>'title','description',coalesce(r.title,'Atividade de manutenção'),'status','pending','createdAt',a->>'createdAt','commander',f->>'commander','copilot',f->>'copilot','standalone',false)
 from public.operational_wall_posts p cross join lateral jsonb_array_elements(coalesce(p.data->'actions','[]')) a
 left join public.maintenance_records r on r.id::text=p.data->>'maintenanceRecordId'
 join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u using(employee_number)
 cross join lateral (select value f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix'=a->>'prefix' and value->>'base'=p.base and value->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD') and coalesce(value->>'planningStatus','confirmed')='confirmed' and value->>'maintenancePostId' is null and coalesce(value->>'cancelled','false')<>'true' and coalesce(value->>'deletedAt','')='' and d.employee_number in(value->>'commander',value->>'copilot') order by value->>'departure' desc limit 1) selected
 where u.active and u.job_role in('commander','copilot') and not p.resolved
 and lower(p.data->>'category') ='power check' and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok');
$function$
;

-- Recover only the proven report-category regression, never an explicit flight deletion.
-- This owner-run repair has no end-user JWT. Suspend the two device checks only
-- inside the migration transaction; table locks prevent concurrent writes.
alter table public.operational_wall_posts disable trigger enforce_wall_area_access;
alter table public.shared_app_state disable trigger enforce_shared_state_access;
do $repair$
declare p public.operational_wall_posts; category text; categories integer; before_data jsonb; repaired jsonb; stamp text:=now()::text;
begin
 for p in select * from public.operational_wall_posts
 where data->>'category' in ('Relato Técnico','Pane','Discrepância','Caso Técnico')
 and not resolved and jsonb_array_length(coalesce(data->'actions','[]'))>0
 for update loop
  select count(distinct f->>'maintenanceCategory'),min(f->>'maintenanceCategory') into categories,category
  from public.shared_app_state s,jsonb_array_elements(s.flights) f
  where s.id='main' and f->>'maintenancePostId'=p.id
  and f->>'maintenanceCategory' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção')
  and f->>'maintenanceSourceDeleted'='true' and coalesce(f->>'cancelled','false')<>'true'
  and exists(select 1 from jsonb_array_elements(p.data->'actions') a where a->>'id'=f->>'maintenanceActionId' and coalesce(a->>'status','pending') not in ('satisfactory','resolved','closed','ok'));
  if categories<>1 then continue;end if;
  before_data:=p.data;
  update public.operational_wall_posts set
   data=jsonb_set(data,'{category}',to_jsonb(category))||jsonb_build_object('history',coalesce(data->'history','[]')||jsonb_build_array(jsonb_build_object('employeeNumber','system','at',stamp,'event','Categoria da atividade restaurada após correção do vínculo ao relato','categoryBefore',before_data->>'category','categoryAfter',category))),
   revision=revision+1,updated_at=now()
  where id=p.id;
  perform 1 from public.shared_app_state where id='main' for update;
  select jsonb_agg(case when f->>'maintenancePostId'=p.id
   and f->>'maintenanceSourceDeleted'='true' and coalesce(f->>'deletedAt','')<>''
   and coalesce(f->>'cancelled','false')<>'true' and f->>'maintenanceCategory'=category
   and coalesce(f->>'shutdown','pending')<>'ok' and nullif(f->>'operationEndedAt','') is null
   and exists(select 1 from jsonb_array_elements(before_data->'actions') a where a->>'id'=f->>'maintenanceActionId' and coalesce(a->>'status','pending') not in ('satisfactory','resolved','closed','ok'))
   then (f-'deletedAt'-'deletedBy'-'maintenanceSourceDeleted')
    ||case when nullif(f->>'operationStartedAt','') is null and nullif(f->>'actualEngineStart','') is null and coalesce(f->>'engineStart','pending')<>'ok'
      and not exists(select 1 from public.flight_operation_records r where r.flight_id=f->>'id' and coalesce(r.events,'[]') not in ('[]'::jsonb,'{}'::jsonb))
      then jsonb_build_object('planningStatus','planned','commander','','copilot','') else '{}'::jsonb end
    ||jsonb_build_object('revision',coalesce((f->>'revision')::int,0)+1,'updatedBy','system','maintenanceRecoveredAt',stamp,
     'history',coalesce(f->'history','[]')||jsonb_build_array(jsonb_build_object('field','maintenanceRoutingRecovery','value','Vínculo recuperado; programação pendente da coordenação quando ainda não iniciada','employeeNumber','system','at',stamp,'before',jsonb_build_object('deletedAt',f->>'deletedAt','deletedBy',f->>'deletedBy','planningStatus',f->>'planningStatus','commander',f->>'commander','copilot',f->>'copilot'))))
   else f end order by n) into repaired from public.shared_app_state s,jsonb_array_elements(s.flights) with ordinality t(f,n) where s.id='main';
  update public.shared_app_state set flights=repaired,revision=revision+1,updated_at=now() where id='main' and flights is distinct from repaired;
 end loop;
end $repair$;
alter table public.operational_wall_posts enable trigger enforce_wall_area_access;
alter table public.shared_app_state enable trigger enforce_shared_state_access;
