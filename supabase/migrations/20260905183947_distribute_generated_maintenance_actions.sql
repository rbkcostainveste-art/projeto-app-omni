create or replace function public.create_wall_action_from_maintenance_record(
  p_record_id uuid,
  p_category text,
  p_title text,
  p_assigned_to text[],
  p_result text,
  p_tc text
) returns text
language plpgsql security definer set search_path=public
as $$
declare
  v_identity public.device_identities;
  v_role text;
  v_record public.maintenance_records%rowtype;
  v_wall_id uuid:=gen_random_uuid();
  v_action_id uuid:=gen_random_uuid();
  v_at text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_ticket text;
  v_description text;
  v_data jsonb;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  select job_role into v_role from public.authorized_users where employee_number=v_identity.employee_number and active=true;
  if v_identity.employee_number is null then raise exception 'Usuário não identificado'; end if;
  if coalesce(v_role,'') not in ('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then
    raise exception 'Somente inspetores e liderança podem gerar ações';
  end if;
  select * into v_record from public.maintenance_records where id=p_record_id for update;
  if not found then raise exception 'Registro técnico não encontrado'; end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_category),'') is null then raise exception 'Informe o título e o tipo da ação'; end if;
  if v_role not in ('admin','app_manager','maintenance_director','maintenance_manager') and v_record.base <> coalesce(v_identity.assigned_base,'') then raise exception 'Registro fora da sua base'; end if;
  v_ticket:=public.next_maintenance_ticket('GMN',v_record.prefix);
  v_description:='Vinculada a '||coalesce(v_record.ticket_code,v_record.id::text)||' — '||v_record.title;
  v_data:=jsonb_build_object(
    'id',v_wall_id,'ticketCode',v_ticket,'title',trim(p_title),'body',v_description,
    'base',v_record.base,'audienceArea','maintenance','category',trim(p_category),
    'priority',case when v_record.priority='urgent' then 'urgent' else 'routine' end,
    'pinned',false,'essential',false,'resolved',false,'createdBy',v_identity.employee_number,
    'createdAt',v_at,'updatedAt',v_at,'revision',1,'attachments','[]'::jsonb,
    'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,
    'history',jsonb_build_array(jsonb_build_object('employeeNumber',v_identity.employee_number,'at',v_at,'event','Criou ação de manutenção pendente')),
    'actions',jsonb_build_array(jsonb_build_object('id',v_action_id,'ticketCode',v_ticket,'prefix',v_record.prefix,'title',trim(p_title),'description',v_description,'assignedTo',array_to_string(coalesce(p_assigned_to,'{}'),', '),'status','pending','views','[]'::jsonb,'acknowledgements','[]'::jsonb,'executions','[]'::jsonb,'createdAt',v_at)),
    'maintenanceRecordId',v_record.id::text,'originShift',v_record.data->>'originShift',
    'originMission',v_record.data->>'originMission','tc',nullif(trim(coalesce(p_tc,'')),'')
  );
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data,created_by)
  values(v_wall_id,v_record.base,'maintenance',false,false,false,v_data,v_identity.employee_number);
  update public.maintenance_records set
    data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'id',gen_random_uuid(),'kind','assignment','description','Gerou ação pendente: '||trim(p_category)||' — '||trim(p_title),
      'employeeNumber',v_identity.employee_number,'at',v_at,'wallPostId',v_wall_id,'assignedTo',to_jsonb(p_assigned_to)))),
    updated_at=v_at::timestamptz
  where id=p_record_id;
  return v_wall_id::text;
end;
$$;

revoke all on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text) from public,anon;
grant execute on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text) to authenticated;

-- Share only the operational action with coordination; technical notices remain in maintenance.
create policy "coordination reads maintenance activities" on public.operational_wall_posts
for select to authenticated using (
 audience_area='maintenance' and jsonb_array_length(coalesce(data->'actions','[]'::jsonb))>0
 and exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=(select auth.uid()) and u.active and u.job_role='coordination'
 and (operational_wall_posts.base='Todas' or operational_wall_posts.base=d.assigned_base))
);

-- Per-action projection avoids exposing the technical post or other assignments to pilots.
create or replace function public.list_crew_maintenance_actions()
returns setof jsonb language sql stable security definer set search_path='' as $$
 select action || jsonb_build_object('category',p.data->>'category','base',p.base)
 from public.operational_wall_posts p
 cross join lateral jsonb_array_elements(coalesce(p.data->'actions','[]'::jsonb)) action
 join public.device_identities d on d.auth_user_id=(select auth.uid())
 join public.authorized_users u on u.employee_number=d.employee_number and u.active
 where u.job_role in ('commander','copilot','pilot')
 and (p.base='Todas' or p.base=d.assigned_base)
 and not p.resolved
 and (
   d.employee_number=any(regexp_split_to_array(coalesce(action->>'assignedTo',''), '\s*,\s*'))
   or exists(select 1 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f
     where s.id='main' and f->>'prefix'=action->>'prefix' and f->>'base'=d.assigned_base
     and f->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')
     and coalesce(f->>'deletedAt','')='' and coalesce(f->>'cancelled','false')<>'true'
     and d.employee_number in (f->>'commander',f->>'copilot'))
 )
 and (coalesce(action->>'status','pending') not in ('satisfactory','resolved','closed','ok')
   or (action->>'createdAt')::timestamptz >= date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;
revoke all on function public.list_crew_maintenance_actions() from public,anon;
grant execute on function public.list_crew_maintenance_actions() to authenticated;
