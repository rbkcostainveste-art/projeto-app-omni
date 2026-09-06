-- Route maintenance activities according to their operational purpose.
CREATE OR REPLACE FUNCTION private.sync_maintenance_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb; f jsonb; previous jsonb; aircraft jsonb; origin public.maintenance_records; fid text; patch jsonb; card jsonb; finished boolean; stamp text;
begin
 if coalesce(new.data->>'category','') not in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') then return new;end if;
 select * into origin from public.maintenance_records where id=(new.data->>'maintenanceRecordId')::uuid;
 for a in select value from jsonb_array_elements(coalesce(new.data->'actions','[]')) loop
  fid:='maintenance-'||(a->>'id');
  perform 1 from public.shared_app_state where id='main' for update;
  select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=fid;
  patch:=jsonb_build_object('maintenancePostId',new.id,'maintenanceActionId',a->>'id','maintenanceRecordId',origin.id,'maintenancePriority',case when new.data->>'priority'='critical' then 'critical' when origin.priority in ('urgent','logged') or new.data->>'priority'='urgent' then 'urgent' else coalesce(new.data->>'priority','routine') end,'maintenanceCategory',new.data->>'category','maintenancePurpose',a->>'title','maintenanceOriginTitle',coalesce(origin.title,'Atividade de manutenção'),'maintenanceEditedAt',a->>'editedAt');
  if f is null then
   select value into aircraft from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') where s.id='main' and value->>'prefix'=a->>'prefix' limit 1;
   select value into previous from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix'=a->>'prefix' and coalesce(value->>'deletedAt','')='' and coalesce(value->>'cancelled','false')<>'true' and value->>'date'=to_char((a->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo','YYYY-MM-DD') and value->>'maintenancePostId' is null order by case when value->>'id'=origin.source_flight_id::text then 0 else 1 end,(value->>'departure') desc limit 1;
   finished:=a->>'status' in ('satisfactory','resolved');stamp:=coalesce(a#>>'{executions,0,at}',a->>'createdAt');
   card:=patch||jsonb_build_object('id',fid,'prefix',a->>'prefix','model',coalesce(aircraft->>'model',origin.model),'base',new.base,'date',to_char((a->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'departure',to_char((a->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo','HH24:MI'),'destination','','duration',0,'fuelAmount',0,'fuelUnit','lb','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown',case when finished then 'ok' else 'pending' end,'operationEndedAt',case when finished then stamp else null end,'planningStatus','confirmed','commander',coalesce(previous->>'commander',''),'copilot',coalesce(previous->>'copilot',''),'flightAttendant','','revision',1,'acknowledged','{}'::jsonb,'createdBy',new.data->>'createdBy','updatedBy',new.data->>'createdBy','history','[]'::jsonb);
   update public.shared_app_state set flights=flights||jsonb_build_array(card),revision=revision+1,updated_at=now() where id='main';
  elsif f||patch<>f then
   update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=fid then value||patch else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';
  end if;
 end loop;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.create_maintenance_request(p_record_id uuid, p_category text, p_title text, p_assigned_to text[], p_tc text, p_plan jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_post_id text; media jsonb;
begin
 v_post_id:=public.create_wall_action_from_maintenance_record(p_record_id,p_category,p_title,p_assigned_to,null,p_tc);
 if p_category in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') then perform public.configure_maintenance_operation(v_post_id,p_plan);end if;
 media:=coalesce(nullif(p_plan->>'attachments','')::jsonb,'[]'::jsonb);
 if jsonb_typeof(media)<>'array' then raise exception 'Anexos inválidos';end if;
 if jsonb_array_length(media)>0 then
  if exists(select 1 from jsonb_array_elements(media) a where coalesce(a->>'bucket','')<>'record-media' or split_part(a->>'url','/',1)<>'maintenance' or split_part(a->>'url','/',2)<>p_record_id::text or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo fora do registro';end if;
  update public.operational_wall_posts set data=jsonb_set(data,'{attachments}',media),revision=revision+1 where operational_wall_posts.id=v_post_id;
  update public.maintenance_records set data=jsonb_set(data,'{entries}',(select jsonb_agg(case when e->>'wallPostId'=v_post_id then e||jsonb_build_object('attachments',media) else e end order by n) from jsonb_array_elements(data->'entries') with ordinality t(e,n))),revision=revision+1 where maintenance_records.id=p_record_id;
 end if;
 return v_post_id;
end $function$;

CREATE OR REPLACE FUNCTION public.list_maintenance_operation_cards()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',f->>'maintenanceActionId','postId',f->>'maintenancePostId','flightId',f->>'id','prefix',f->>'prefix','model',f->>'model','base',f->>'base','title',f->>'maintenancePurpose','description',f->>'maintenanceOriginTitle','category',f->>'maintenanceCategory','spot',f->>'spot','crewRequirement',f->>'crewRequirement','commander',f->>'commander','copilot',f->>'copilot','date',f->>'date','departure',f->>'departure','editedAt',f->>'maintenanceEditedAt','createdAt',(f->>'date')||'T'||(f->>'departure')||':00-03:00','status',case when f->>'shutdown'='ok' then 'completed' else 'pending' end)
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f
 join public.device_identities d on d.auth_user_id=(select auth.uid()) join public.authorized_users u on u.employee_number=d.employee_number and u.active
 where s.id='main' and f->>'maintenanceCategory' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') and f->>'maintenancePostId' is not null and coalesce(f->>'deletedAt','')='' and coalesce(f->>'cancelled','false')<>'true'
 and (u.job_role in ('admin','app_manager','maintenance_director','maintenance_manager') or d.assigned_base is null or f->>'base'=d.assigned_base)
 and (u.job_role in ('admin','app_manager','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant') or u.job_role in ('commander','copilot') and u.employee_number in(f->>'commander',f->>'copilot'));
$function$;
-- Display name normalization, including standalone activities. S92 has no CT disk wash.
create or replace function private.validate_wash_request() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb; model text;
begin
 if lower(new.data->>'category')='lavagem da ct disk' then
  new.data:=jsonb_set(new.data,'{category}','"Lavagem da CT disk"');
  for a in select value from jsonb_array_elements(coalesce(new.data->'actions','[]')) loop
   select value->>'model' into model from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') where s.id='main' and value->>'prefix'=a->>'prefix';
   if regexp_replace(upper(coalesce(model,'')),'[^A-Z0-9]','','g')='S92' then raise exception 'Lavagem da CT disk não se aplica ao S-92';end if;
  end loop;
 end if;
 return new;
end $$;
create trigger validate_wash_request before insert or update of data on public.operational_wall_posts for each row execute function private.validate_wash_request();
revoke all on function private.validate_wash_request() from public,anon,authenticated;

-- Sanitized task projection: pilots receive purpose, never the technical conversation/results.
create or replace function public.list_crew_maintenance_actions() returns setof jsonb language sql stable security definer set search_path='' as $$
 select card from public.list_maintenance_operation_cards() card
 where exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and u.job_role in('commander','copilot'))
 and (card->>'status'='pending' or card->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
 union all
 select jsonb_build_object('id',a->>'id','postId',p.id,'prefix',a->>'prefix','category',case when lower(p.data->>'category')='lavagem da ct disk' then 'Lavagem da CT disk' else p.data->>'category' end,'title',a->>'title','description',coalesce(r.title,'Atividade de manutenção'),'status','pending','createdAt',a->>'createdAt','commander',f->>'commander','copilot',f->>'copilot','standalone',false)
 from public.operational_wall_posts p cross join lateral jsonb_array_elements(coalesce(p.data->'actions','[]')) a
 left join public.maintenance_records r on r.id::text=p.data->>'maintenanceRecordId'
 join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u using(employee_number)
 cross join lateral (select value f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix'=a->>'prefix' and value->>'base'=p.base and value->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD') and value->>'maintenancePostId' is null and coalesce(value->>'cancelled','false')<>'true' and coalesce(value->>'deletedAt','')='' and d.employee_number in(value->>'commander',value->>'copilot') order by value->>'departure' desc limit 1) selected
 where u.active and u.job_role in('commander','copilot') and p.base=d.assigned_base and not p.resolved
 and lower(p.data->>'category') in('power check','lavagem da ct disk','lavagem com produto') and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok');
$$;

create or replace function public.list_runway_wash_requests() returns setof jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('postId',p.id,'actionId',a->>'id','prefix',a->>'prefix','base',p.base,'key',case when lower(p.data->>'category')='lavagem da ct disk' then 'ctDiskWash' else 'productWash' end)
 from public.operational_wall_posts p,jsonb_array_elements(coalesce(p.data->'actions','[]')) a
 where not p.resolved and lower(p.data->>'category') in('lavagem da ct disk','lavagem com produto') and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok');
$$;
revoke all on function public.list_runway_wash_requests() from public,anon;
grant execute on function public.list_runway_wash_requests() to authenticated;

alter table public.compressor_drying_tasks add column reasons text[] not null default '{}';
alter table public.compressor_drying_tasks add column handover_ids text[] not null default '{}';
update public.compressor_drying_tasks set reasons=array[reason],handover_ids=case when source_type='runway_handover' then array[source_id] else '{}' end;
-- A completed action is not proof of a runway wash: only the runway confirmation creates drying.
drop trigger if exists enqueue_drying_after_wall_action on public.operational_wall_posts;

create or replace function private.reset_drying_after_new_wash() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; has_request boolean;
begin
 foreach k in array array['compressorWash','ctDiskWash','productWash'] loop
  if k<>'compressorWash' then
   select exists(select 1 from public.operational_wall_posts p,jsonb_array_elements(coalesce(p.data->'actions','[]')) a where p.base=new.base and a->>'prefix'=new.prefix and not p.resolved and lower(p.data->>'category')=case when k='ctDiskWash' then 'lavagem da ct disk' else 'lavagem com produto' end and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok')) into has_request;
   if new.checks->>k='yes' and (tg_op='INSERT' or old.checks->>k is distinct from 'yes') and not has_request then raise exception 'Lavagem sem ação de manutenção pendente';end if;
   if k='ctDiskWash' and regexp_replace(upper(new.model),'[^A-Z0-9]','','g')='S92' then
    if new.checks->>k='yes' then raise exception 'Lavagem da CT disk não se aplica ao S-92';end if;
    new.checks:=new.checks-k;
   elsif has_request then new.checks:=jsonb_set(new.checks,array[k],coalesce(new.checks->k,'"pending"'));
   elsif coalesce(new.checks->>k,'pending')='pending' then new.checks:=new.checks-k;end if;
  end if;
  if new.checks->>k='yes' and (tg_op='INSERT' or old.checks->>k is distinct from 'yes') then
   new.checks:=jsonb_set(new.checks,'{dryingRun}','"pending"');new.actions:=coalesce(new.actions,'{}')-'dryingRun';
  end if;
 end loop;
 return new;
end $$;

create or replace function private.enqueue_runway_compressor_drying() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; employee text; role_name text; added text[]:='{}'; pending public.compressor_drying_tasks; p record; updated_actions jsonb; stamp text;
begin
 foreach k in array array['compressorWash','ctDiskWash','productWash'] loop
  if new.checks->>k='yes' and (tg_op='INSERT' or old.checks->>k is distinct from 'yes') then
   added:=array_append(added,case k when 'ctDiskWash' then 'Lavagem da CT disk' when 'productWash' then 'Lavagem com produto' else 'Lavagem dos compressores' end);
  end if;
 end loop;
 if cardinality(added)=0 then return new;end if;
 select d.employee_number,u.job_role into employee,role_name from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if employee is null or role_name not in('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','admin','app_manager') then raise exception 'Manutenção habilitada necessária para confirmar lavagem';end if;
 perform pg_advisory_xact_lock(hashtextextended('drying:'||new.base||':'||new.prefix,0));
 select * into pending from public.compressor_drying_tasks where prefix=new.prefix and base=new.base and status='pending' order by triggered_at limit 1 for update;
 if pending.id is not null then
  update public.compressor_drying_tasks set reasons=(select array_agg(distinct x order by x) from unnest(reasons||added) x),reason=(select string_agg(distinct x,' + ' order by x) from unnest(reasons||added) x),handover_ids=(select array_agg(distinct x) from unnest(handover_ids||array[new.id]) x) where id=pending.id;
 else
  insert into public.compressor_drying_tasks(source_type,source_id,prefix,model,base,reason,reasons,handover_ids,triggered_by,triggered_at)
  values('runway_handover',new.id,new.prefix,new.model,new.base,array_to_string(added,' + '),added,array[new.id],employee,now())
  on conflict(source_type,source_id) do update set status='pending',completed_by=null,completed_at=null,reasons=excluded.reasons,reason=excluded.reason,handover_ids=excluded.handover_ids,triggered_by=employee,triggered_at=now();
 end if;
 stamp:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 for p in select * from public.operational_wall_posts where base=new.base and not resolved and lower(data->>'category') in('lavagem da ct disk','lavagem com produto') for update loop
  k:=case when lower(p.data->>'category')='lavagem da ct disk' then 'ctDiskWash' else 'productWash' end;
  if new.checks->>k='yes' and (tg_op='INSERT' or old.checks->>k is distinct from 'yes') then
   select jsonb_agg(case when a->>'prefix'=new.prefix and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok') then a||jsonb_build_object('status','satisfactory','runwayHandoverId',new.id,'executions',coalesce(a->'executions','[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'employeeNumber',employee,'at',stamp,'description','Lavagem confirmada na Passagem de Pista','result','satisfactory','attachments','[]'::jsonb))) else a end order by n) into updated_actions from jsonb_array_elements(p.data->'actions') with ordinality t(a,n);
   if updated_actions is distinct from p.data->'actions' then update public.operational_wall_posts set data=jsonb_set(data,'{actions}',updated_actions),revision=revision+1,updated_at=now() where id=p.id;end if;
  end if;
 end loop;
 return new;
end $$;

create or replace function private.sync_drying_completion_to_runway() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and old.status is distinct from new.status then
  update public.runway_handovers set checks=jsonb_set(checks,'{dryingRun}','"yes"'),actions=jsonb_set(coalesce(actions,'{}'),'{dryingRun}',jsonb_build_object('employeeNumber',new.completed_by,'at',new.completed_at)),updated_at=new.completed_at,revision=revision+1 where (id=any(new.handover_ids) or new.source_type='runway_handover' and id=new.source_id) and checks->>'dryingRun' is distinct from 'yes';
 end if;return new;
end $$;
create or replace function private.sync_runway_drying_completion() returns trigger language plpgsql security definer set search_path='' as $$
declare employee text;role_name text;
begin
 if new.checks->>'dryingRun'='yes' and (tg_op='INSERT' or old.checks->>'dryingRun' is distinct from 'yes') then
  select d.employee_number,u.job_role into employee,role_name from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
  -- No pending row means this is the reverse update from the drying queue.
  if not exists(select 1 from public.compressor_drying_tasks where status='pending' and (new.id=any(handover_ids) or source_type='runway_handover' and source_id=new.id)) then return new;end if;
  if role_name not in('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','admin','app_manager') or employee is null then raise exception 'Somente manutenção habilitada confirma a secagem na passagem';end if;
  update public.compressor_drying_tasks set status='completed',completed_by=employee,completed_at=now() where status='pending' and (new.id=any(handover_ids) or source_type='runway_handover' and source_id=new.id);
 end if;return new;
end $$;

create or replace function public.complete_compressor_drying(p_task_id uuid) returns public.compressor_drying_tasks language plpgsql security definer set search_path='' as $$
declare actor public.device_identities; role_name text; result public.compressor_drying_tasks;
begin
 select * into actor from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 select * into result from public.compressor_drying_tasks where id=p_task_id;
 if actor.auth_user_id is null or coalesce(role_name,'') not in('commander','copilot','mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','admin','app_manager') then raise exception 'Sem permissão para confirmar secagem';end if;
 if result.id is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and result.base is distinct from actor.assigned_base) then raise exception 'Secagem fora da base';end if;
 perform 1 from public.runway_handovers where id=any(result.handover_ids) or (result.source_type='runway_handover' and id=result.source_id) order by id for update;
 update public.compressor_drying_tasks set status='completed',completed_by=actor.employee_number,completed_at=now() where id=p_task_id and status='pending' returning * into result;
 if result.id is null then select * into result from public.compressor_drying_tasks where id=p_task_id;end if;
 return result;
end $$;
-- Drying owns a separate operational trail, created only after an actual wash.
create or replace function private.sync_drying_trail() returns trigger language plpgsql security definer set search_path='' as $$
declare fid text; f jsonb; card jsonb; stamp timestamptz;
begin
 fid:='drying-'||new.id;stamp:=new.triggered_at;
 perform 1 from public.shared_app_state where id='main' for update;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=fid;
 card:=jsonb_build_object('id',fid,'compressorDryingTaskId',new.id,'maintenancePostId',fid,'maintenanceCategory','Secagem de compressores','maintenancePurpose',new.reason,'maintenanceOriginTitle','Lavagem confirmada na Passagem de Pista','maintenancePriority','routine','prefix',new.prefix,'model',new.model,'base',new.base,'date',to_char(stamp at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'departure',to_char(stamp at time zone 'America/Sao_Paulo','HH24:MI'),'destination','','duration',0,'fuelAmount',0,'fuelUnit','lb','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown',case when new.status='completed' then 'ok' else 'pending' end,'operationEndedAt',new.completed_at,'planningStatus','confirmed','commander','','copilot','','flightAttendant','','createdBy',new.triggered_by,'updatedBy',coalesce(new.completed_by,new.triggered_by),'revision',coalesce((f->>'revision')::int,0)+1,'acknowledged',coalesce(f->'acknowledged','{}'::jsonb),'history',coalesce(f->'history','[]'::jsonb));
 if f is null then update public.shared_app_state set flights=flights||jsonb_build_array(card),revision=revision+1,updated_at=now() where id='main';
 else update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=fid then value||card else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';end if;
 return new;
end $$;
revoke all on function private.sync_drying_trail() from public,anon,authenticated;
create trigger sync_drying_trail after insert or update on public.compressor_drying_tasks for each row execute function private.sync_drying_trail();

-- Backfill under the migration transaction; restore access enforcement before commit.
alter table public.shared_app_state disable trigger enforce_shared_state_access;
-- Retire only old, unstarted projections, preserving their maintenance tasks and audit history.
update public.shared_app_state set flights=(select jsonb_agg(case when f->>'maintenancePostId' is not null and lower(f->>'maintenanceCategory') in('power check','lavagem da ct disk','lavagem com produto') and coalesce(f->>'operationStartedAt','')='' and coalesce(f->>'engineStart','pending')<>'ok' and coalesce(f->>'deletedAt','')='' then f||jsonb_build_object('deletedAt',now(),'maintenanceRetired',true,'retirementReason','Atividade sem voo/giro próprio') else f end order by n) from jsonb_array_elements(flights) with ordinality t(f,n)),revision=revision+1 where id='main';
update public.compressor_drying_tasks set reason=reason where status='pending';

-- Coordination occurrences outlive the flight and have their own acknowledgement/closure.
create table public.coordination_technical_alerts (
 id uuid primary key default gen_random_uuid(),flight_id text not null,prefix text not null,base text not null,reason text not null,occurred_at timestamptz not null,on_ground boolean not null default false,
 closed_at timestamptz,closed_by text,closure_note text,unique(flight_id,occurred_at)
);
create table public.coordination_alert_reads(alert_id uuid not null references public.coordination_technical_alerts(id) on delete cascade,employee_number text not null,seen_at timestamptz not null default now(),primary key(alert_id,employee_number));
alter table public.coordination_technical_alerts enable row level security;
alter table public.coordination_alert_reads enable row level security;
revoke all on public.coordination_technical_alerts,public.coordination_alert_reads from anon,authenticated;
grant select on public.coordination_technical_alerts,public.coordination_alert_reads to authenticated;
create or replace function public.can_view_coordination_alert(p_base text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and u.job_role in('coordination','dispatch','admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') and (u.job_role in('admin','app_manager','maintenance_director','maintenance_manager') or d.assigned_base is null or d.assigned_base=p_base));
$$;
revoke all on function public.can_view_coordination_alert(text) from public,anon;
grant execute on function public.can_view_coordination_alert(text) to authenticated;
create policy "coordination reads its alerts" on public.coordination_technical_alerts for select to authenticated using(public.can_view_coordination_alert(base));
create policy "users read own alert acknowledgements" on public.coordination_alert_reads for select to authenticated using(employee_number=(select employee_number from public.device_identities where auth_user_id=auth.uid()));
create or replace function private.sync_coordination_return_alerts() returns trigger language plpgsql security definer set search_path='' as $$
declare f jsonb; stamp timestamptz;ground boolean;
begin
 for f in select value from jsonb_array_elements(new.flights) where value->>'returned'='true' and lower(trim(coalesce(value->>'returnReason',''))) in('pane','indisponível','indisponivel') loop
  stamp:=coalesce(nullif(f->>'returnedAt','')::timestamptz,(f->>'date')::date::timestamptz);
  ground:=f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null or nullif(f->>'operationEndedAt','') is not null;
  insert into public.coordination_technical_alerts(flight_id,prefix,base,reason,occurred_at,on_ground) values(f->>'id',f->>'prefix',f->>'base',f->>'returnReason',stamp,coalesce(ground,false))
  on conflict(flight_id,occurred_at) do update set on_ground=excluded.on_ground where coordination_technical_alerts.on_ground is distinct from excluded.on_ground;
 end loop;return new;
end $$;
revoke all on function private.sync_coordination_return_alerts() from public,anon,authenticated;
create trigger sync_coordination_return_alerts after insert or update of flights on public.shared_app_state for each row execute function private.sync_coordination_return_alerts();
create or replace function public.update_coordination_alert(p_id uuid,p_action text,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare a public.coordination_technical_alerts;employee text;
begin
 select * into a from public.coordination_technical_alerts where id=p_id for update;
 if a.id is null or not public.can_view_coordination_alert(a.base) then raise exception 'Alerta indisponível para este usuário';end if;
 select employee_number into employee from public.device_identities where auth_user_id=auth.uid();
 if p_action='read' then insert into public.coordination_alert_reads(alert_id,employee_number) values(p_id,employee) on conflict do nothing;
 elsif p_action='close' then
  if nullif(trim(p_note),'') is null then raise exception 'Informe o motivo do encerramento do acompanhamento';end if;
  update public.coordination_technical_alerts set closed_at=now(),closed_by=employee,closure_note=trim(p_note) where id=p_id and closed_at is null;
 else raise exception 'Ação inválida';end if;
end $$;
revoke all on function public.update_coordination_alert(uuid,text,text) from public,anon;
grant execute on function public.update_coordination_alert(uuid,text,text) to authenticated;
alter publication supabase_realtime add table public.coordination_technical_alerts,public.coordination_alert_reads;
-- Existing recorded returns become visible too; no inference of technical resolution.
update public.shared_app_state set flights=flights where id='main';

alter table public.shared_app_state enable trigger enforce_shared_state_access;
