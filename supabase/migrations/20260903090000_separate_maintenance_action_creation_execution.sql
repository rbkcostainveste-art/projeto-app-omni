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
  v_identity record;
  v_record public.maintenance_records%rowtype;
  v_wall_id uuid:=gen_random_uuid();
  v_action_id uuid:=gen_random_uuid();
  v_at text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_ticket text;
  v_description text;
  v_data jsonb;
begin
  select * into v_identity from public.current_app_identity();
  if v_identity.employee_number is null then raise exception 'Usuário não identificado'; end if;
  if v_identity.access_profile not in ('admin','app_manager','legacy','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then
    raise exception 'Somente inspetores e liderança podem gerar ações';
  end if;
  select * into v_record from public.maintenance_records where id=p_record_id;
  if not found then raise exception 'Registro técnico não encontrado'; end if;
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
  return v_wall_id::text;
end;
$$;

revoke all on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text) from public,anon;
grant execute on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text) to authenticated;
