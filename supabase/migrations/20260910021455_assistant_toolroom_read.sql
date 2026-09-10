-- Read-only endpoint: existing toolbox dashboard performs maintenance writes and returns broad data.
create or replace function public.assistant_toolroom_read(p_employee text, p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user public.authorized_users; v_role text; v_global boolean; v_personal boolean; v_result jsonb;
begin
 select u.* into v_user from public.authorized_users u join public.device_identities d on d.employee_number=u.employee_number
 where d.auth_user_id=auth.uid() and u.active and u.employee_number=p_employee;
 if v_user.id is null then raise exception 'Acesso indisponível'; end if;
 v_role:=coalesce(v_user.job_role,v_user.access_profile);
 v_global:=v_role in ('admin','app_manager','maintenance_director','maintenance_manager');
 v_personal:=v_role in ('mechanic','maintenance_assistant');
 if not v_global and v_role not in ('toolroom','mechanic','maintenance_assistant','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Acesso indisponível'; end if;
 if not v_global and nullif(btrim(v_user.assigned_base),'') is null then raise exception 'Base não definida'; end if;
 with authorized_boxes as (
  select b.* from public.toolboxes b where (v_global or b.base=v_user.assigned_base)
 ), authorized_operations as (
  select o.* from public.toolbox_operations o join authorized_boxes b on b.id=o.box_id
  where (p_id is null or o.id=p_id) and (not v_personal or o.assigned_to=p_employee or exists(select 1 from public.toolbox_events e where e.operation_id=o.id and e.employee_number=p_employee))
 ), selected_operations as (
  select * from authorized_operations order by created_at desc,id limit 100
 ), selected_boxes as (
  select * from authorized_boxes b where p_id is null or exists(select 1 from selected_operations o where o.box_id=b.id) order by code,id limit 300
 ) select jsonb_build_object(
  'status','available','scope',case when v_global then 'Bases autorizadas' else v_user.assigned_base end,
  'complete',(select count(*)<=100 from authorized_operations) and (select count(*)<=300 from authorized_boxes),
  'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'name',b.name,'base',b.base,'status',b.status,'aircraft_prefix',b.aircraft_prefix)) from selected_boxes b),'[]'::jsonb),
  'operations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'box_id',o.box_id,'status',o.status,'assigned_to',o.assigned_to,'aircraft_prefix',o.aircraft_prefix,'notes',o.notes,'created_at',o.created_at,'completed_at',o.completed_at,'return_intent_at',o.return_intent_at,
    'event_count',(select count(*) from public.toolbox_events e where e.operation_id=o.id and (not v_personal or o.assigned_to=p_employee or e.employee_number=p_employee)),
    'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select e.id,e.event_type,e.status,e.employee_number,e.aircraft_prefix,e.description,e.created_at,e.returned_at,e.confirmed_at,e.tool_refs from public.toolbox_events e where e.operation_id=o.id and (not v_personal or o.assigned_to=p_employee or e.employee_number=p_employee) order by e.created_at desc,e.id limit 60) e),'[]'::jsonb))) from selected_operations o),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.assistant_toolroom_read(text,uuid) from public,anon;
grant execute on function public.assistant_toolroom_read(text,uuid) to authenticated;
