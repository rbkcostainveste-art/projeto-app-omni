CREATE OR REPLACE FUNCTION public.get_operational_assignments()
 RETURNS TABLE(employee_number text, display_name text, access_profile text, assigned_base text, fleets text[], mission text, work_shift text, avatar_data_url text, active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_identity public.device_identities; begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid();
 if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector','mechanic','commander','copilot','flight_attendant')) then raise exception 'Sem permissão para consultar pessoas'; end if;
 return query select u.employee_number,u.display_name,coalesce(u.job_role,u.access_profile),u.assigned_base,u.fleets,u.mission,u.work_shift,u.avatar_data_url,u.active from public.authorized_users u where u.active and (v_identity.is_admin or v_identity.access_profile not in ('commander','copilot','flight_attendant') or u.employee_number=v_identity.employee_number) order by u.display_name,u.employee_number;
end $function$;

CREATE OR REPLACE FUNCTION public.create_scoped_activity(p_id text, p_base text, p_scope text, p_prefix text, p_fleet text, p_record_id uuid, p_category text, p_title text, p_tc text, p_assigned text[], p_priority text, p_plan jsonb, p_attachments jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.device_identities; role_name text; origin public.maintenance_records; targets jsonb; plane jsonb; actions jsonb:='[]'; action_id text; payload jsonb; child_id text; child_index int:=0; stamp text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 p_title:=coalesce(nullif(trim(p_title),''),p_category);
 select * into actor from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 if coalesce(role_name,'') not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente liderança e inspetoria podem criar atividades';end if;
 if nullif(trim(p_base),'') is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and p_base is distinct from actor.assigned_base) then raise exception 'Base não permitida';end if;
 if p_scope not in('prefix','fleet','base','none') or p_category not in('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT disk','Lavagem com produto','Procedimentos') or nullif(trim(p_title),'') is null then raise exception 'Informe alcance, tipo e finalidade válidos';end if;
 if p_scope='none' and p_category<>'Procedimentos' then raise exception 'Esta ação exige aeronave. Use Procedimentos para uma atividade geral';end if;
 if p_priority not in('routine','priority','urgent','critical') then raise exception 'Prioridade inválida';end if;
 if exists(select 1 from unnest(coalesce(p_assigned,'{}')) e where not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active and u.job_role='mechanic' and u.assigned_base=p_base)) then raise exception 'Executante fora da base ou não habilitado';end if;
 if jsonb_typeof(p_attachments)<>'array' or exists(select 1 from jsonb_array_elements(p_attachments) a where a->>'bucket'<>'record-media' or split_part(a->>'url','/',1)<>'wall' or split_part(a->>'url','/',2)<>p_id or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo inválido';end if;
 if exists(select 1 from public.operational_wall_posts where id=p_id) then
  if exists(select 1 from public.operational_wall_posts where id=p_id and data->>'createdBy'=actor.employee_number) then return p_id;end if;raise exception 'Identificador já utilizado';
 end if;
 if p_record_id is not null then select * into origin from public.maintenance_records where id=p_record_id;if origin.id is null or origin.base<>p_base or p_scope<>'prefix' or origin.prefix<>p_prefix then raise exception 'Registro incompatível com a aeronave';end if;end if;
 select coalesce(jsonb_agg(a),'[]') into targets from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') a where s.id='main' and a->>'base'=p_base and (p_scope='base' or p_scope='prefix' and a->>'prefix'=p_prefix or p_scope='fleet' and a->>'model'=p_fleet) and (p_category<>'Lavagem da CT disk' or regexp_replace(upper(a->>'model'),'[^A-Z0-9]','','g')<>'S92');
 if p_scope='none' then targets:='[{"prefix":""}]';elsif jsonb_array_length(targets)=0 then raise exception 'Nenhuma aeronave aplicável ao alcance escolhido';end if;
 for plane in select value from jsonb_array_elements(targets) loop
 action_id:=gen_random_uuid()::text;
 actions:=actions||jsonb_build_array(jsonb_build_object('id',action_id,'prefix',plane->>'prefix','title',trim(p_title),'description',coalesce(origin.title,''),'assignedTo',array_to_string(coalesce(p_assigned,'{}'),', '),'status','pending','views','[]'::jsonb,'acknowledgements','[]'::jsonb,'executions','[]'::jsonb,'createdAt',stamp));
 end loop;
 payload:=jsonb_build_object('id',p_id,'title',trim(p_title),'body',coalesce(origin.title,trim(p_title)),'category',p_category,'base',p_base,'audienceArea','maintenance','priority',p_priority,'pinned',false,'essential',false,'resolved',false,'createdBy',actor.employee_number,'createdAt',stamp,'updatedAt',stamp,'revision',1,'attachments',coalesce(p_attachments,'[]'),'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('employeeNumber',actor.employee_number,'at',stamp,'event','Criou atividade')),'actions',actions,'tc',p_tc,'scope',p_scope,'scopeFleet',p_fleet);
 if origin.id is not null then payload:=payload||jsonb_build_object('maintenanceRecordId',origin.id);end if;
 for plane in select value from jsonb_array_elements(actions) loop
 child_id:=case when child_index=0 then p_id else p_id||'-'||child_index end;child_index:=child_index+1;
 insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data) values(child_id,p_base,'maintenance',false,false,false,payload||jsonb_build_object('id',child_id,'activityGroupId',p_id,'actions',jsonb_build_array(plane)));

 end loop;
 if origin.id is not null then update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','assignment','description','Gerou ação pendente: '||p_category||' — '||trim(p_title),'employeeNumber',actor.employee_number,'at',stamp,'wallPostId',p_id,'assignedTo',to_jsonb(p_assigned),'attachments',coalesce(p_attachments,'[]'::jsonb)))),revision=revision+1,updated_at=now() where id=origin.id;end if;
 return p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.create_wall_action_from_maintenance_record(p_record_id uuid, p_category text, p_title text, p_assigned_to text[], p_result text, p_tc text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 p_title:=coalesce(nullif(trim(p_title),''),p_category);
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
  if exists(select 1 from unnest(coalesce(p_assigned_to,'{}')) e where e is null or not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active and u.job_role='mechanic' and u.assigned_base=v_record.base)) then raise exception 'Executante fora da base ou não habilitado';end if;
  v_ticket:=public.next_maintenance_ticket_code('GMN',v_record.prefix,clock_timestamp());
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
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data)
  values(v_wall_id,v_record.base,'maintenance',false,false,false,v_data);
  update public.maintenance_records set
    data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'id',gen_random_uuid(),'kind','assignment','description','Gerou ação pendente: '||trim(p_category)||' — '||trim(p_title),
      'employeeNumber',v_identity.employee_number,'at',v_at,'wallPostId',v_wall_id,'assignedTo',to_jsonb(p_assigned_to)))),
    updated_at=v_at::timestamptz
  where id=p_record_id;
  return v_wall_id::text;
end;
$function$;
