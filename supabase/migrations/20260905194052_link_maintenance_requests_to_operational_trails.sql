-- A maintenance request owns one operational card; technical conversations stay on the post.
create or replace function private.sync_maintenance_operation() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb; f jsonb; previous jsonb; aircraft jsonb; origin public.maintenance_records; fid text; patch jsonb; card jsonb; finished boolean; stamp text;
begin
 if coalesce(new.data->>'category','') not in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT Disk','Lavagem com produto') or nullif(new.data->>'maintenanceRecordId','') is null then return new;end if;
 select * into origin from public.maintenance_records where id=(new.data->>'maintenanceRecordId')::uuid;
 for a in select value from jsonb_array_elements(coalesce(new.data->'actions','[]')) loop
  fid:='maintenance-'||(a->>'id');
  perform 1 from public.shared_app_state where id='main' for update;
  select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=fid;
  patch:=jsonb_build_object('maintenancePostId',new.id,'maintenanceActionId',a->>'id','maintenanceRecordId',origin.id,'maintenanceCategory',new.data->>'category','maintenancePurpose',a->>'title','maintenanceOriginTitle',origin.title,'maintenanceEditedAt',a->>'editedAt');
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
end $$;
revoke all on function private.sync_maintenance_operation() from public,anon,authenticated;
create trigger sync_maintenance_operation after insert or update of data on public.operational_wall_posts for each row execute function private.sync_maintenance_operation();
-- Backfill existing requests without manufacturing events or technical results.
do $$ declare r record;begin
 for r in select id,data->>'createdBy' employee from public.operational_wall_posts where data->>'maintenanceRecordId' is not null and jsonb_array_length(coalesce(data->'actions','[]'))>0 loop
  perform set_config('request.jwt.claim.sub',coalesce((select auth_user_id::text from public.device_identities where employee_number=r.employee limit 1),''),true);
  update public.operational_wall_posts set data=data where id=r.id;
 end loop;
end $$;

create or replace function public.list_maintenance_operation_cards() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',f->>'maintenanceActionId','flightId',f->>'id','prefix',f->>'prefix','model',f->>'model','base',f->>'base','title',f->>'maintenancePurpose','description',f->>'maintenanceOriginTitle','category',f->>'maintenanceCategory','spot',f->>'spot','crewRequirement',f->>'crewRequirement','commander',f->>'commander','copilot',f->>'copilot','date',f->>'date','departure',f->>'departure','editedAt',f->>'maintenanceEditedAt','createdAt',(f->>'date')||'T'||(f->>'departure')||':00-03:00','status',case when f->>'shutdown'='ok' then 'completed' else 'pending' end)
 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f
 join public.device_identities d on d.auth_user_id=(select auth.uid()) join public.authorized_users u on u.employee_number=d.employee_number and u.active
 where s.id='main' and f->>'maintenancePostId' is not null and coalesce(f->>'deletedAt','')='' and coalesce(f->>'cancelled','false')<>'true'
 and (u.job_role in ('admin','app_manager','maintenance_director','maintenance_manager') or d.assigned_base is null or f->>'base'=d.assigned_base)
 and (u.job_role in ('admin','app_manager','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant') or u.job_role in ('commander','copilot') and u.employee_number in(f->>'commander',f->>'copilot'));
$$;
revoke all on function public.list_maintenance_operation_cards() from public,anon;
grant execute on function public.list_maintenance_operation_cards() to authenticated;
create or replace function public.list_crew_maintenance_actions() returns setof jsonb language sql stable security definer set search_path='' as $$
 select card from public.list_maintenance_operation_cards() card where exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=(select auth.uid()) and u.active and u.job_role in('commander','copilot')) and (card->>'status'='pending' or card->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'));
$$;
drop policy if exists "coordination reads maintenance activities" on public.operational_wall_posts;
-- Only the two requested checks apply to maintenance operations.
do $$ declare definition text;begin
 select pg_get_functiondef('private.operation_context(text)'::regprocedure) into definition;
 definition:=replace(definition,'f:=private.operation_flight(p_id);',E'f:=private.operation_flight(p_id);\n if f->>''maintenancePostId'' is not null then return jsonb_build_object(''first'',true,''previousFlightId'',null,''nextFlightId'',null,''day'',f->>''date'');end if;');
 execute definition;
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'key:=p_payload->>''key'';',E'key:=p_payload->>''key'';\n if f->>''maintenancePostId'' is not null and key not in (''fuel'',''inspection'') then raise exception ''Verificação não aplicável ao giro/voo de manutenção'';end if;');
 execute definition;
end $$;


