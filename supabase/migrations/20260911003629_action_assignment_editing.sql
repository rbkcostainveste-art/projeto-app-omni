create or replace function public.edit_maintenance_action(p_post_id text,p_title text,p_expected_revision integer,p_assigned_to text[],p_action_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.device_identities; role_name text; post public.operational_wall_posts; record_id uuid; action jsonb; stamp text; previous text; previous_assigned text; next_assigned text; selected text[]; next_data jsonb; action_index integer;
begin
 select * into actor from public.device_identities where auth_user_id=auth.uid();
 select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 if actor.auth_user_id is null or coalesce(role_name,'') not in ('maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager') then raise exception 'Somente inspetores e liderança podem editar a ação';end if;
 if nullif(trim(p_title),'') is null or length(p_title)>4000 then raise exception 'Informe a finalidade da ação, com até 4.000 caracteres';end if;
 select nullif(data->>'maintenanceRecordId','')::uuid into record_id from public.operational_wall_posts where id=p_post_id;
 if record_id is not null then perform 1 from public.maintenance_records where id=record_id for update;end if;
 select * into post from public.operational_wall_posts where id=p_post_id for update;
 if post.id is null or post.audience_area<>'maintenance' then raise exception 'Atividade de manutenção não encontrada';end if;
 if post.data->>'createdBy' is distinct from actor.employee_number then raise exception 'Somente o autor pode corrigir esta ação';end if;
 if role_name not in ('admin','app_manager','maintenance_manager','maintenance_director') and post.base is distinct from actor.assigned_base then raise exception 'Ação fora da sua base';end if;
 if post.revision is distinct from p_expected_revision then raise exception 'Esta ação foi atualizada. Reabra a edição para carregar a versão atual';end if;
 if p_action_id is null and jsonb_array_length(coalesce(post.data->'actions','[]'))<>1 then raise exception 'Selecione a ação que deseja alterar';end if;
 select value,ordinality::integer-1 into action,action_index from jsonb_array_elements(coalesce(post.data->'actions','[]')) with ordinality where p_action_id is null or value->>'id'=p_action_id;
 if action is null then raise exception 'Ação não encontrada';end if;
 previous:=action->>'title';previous_assigned:=coalesce(action->>'assignedTo','');next_assigned:=previous_assigned;
 if p_assigned_to is not null then
  if exists(select 1 from unnest(p_assigned_to) e where e is null or nullif(trim(e),'') is null) then raise exception 'Executante inválido';end if;
  select coalesce(array_agg(distinct trim(e) order by trim(e)),'{}') into selected from unnest(p_assigned_to) e;
  if exists(select 1 from unnest(selected) e where not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active and u.job_role='mechanic' and u.assigned_base=post.base)) then raise exception 'Executante fora da base ou não habilitado';end if;
  next_assigned:=array_to_string(selected,', ');
 end if;
 if previous=trim(p_title) and previous_assigned=next_assigned then return jsonb_build_object('data',post.data,'revision',post.revision);end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 action:=action||jsonb_build_object('title',trim(p_title),'assignedTo',next_assigned,'editedAt',stamp,'editedBy',actor.employee_number,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,
  'edits',coalesce(action->'edits','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',stamp,'employeeNumber',actor.employee_number,'before',previous,'after',trim(p_title),'assignedBefore',previous_assigned,'assignedAfter',next_assigned)));
 next_data:=jsonb_set(post.data,array['actions',action_index::text],action)||jsonb_build_object('updatedAt',stamp,'revision',post.revision+1,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,
  'history',coalesce(post.data->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',stamp,'employeeNumber',actor.employee_number,'event','Atualizou a finalidade ou designação da ação')));
 if jsonb_array_length(post.data->'actions')=1 then next_data:=next_data||jsonb_build_object('title',trim(p_title));end if;
 update public.operational_wall_posts set data=next_data,revision=post.revision+1,updated_at=stamp::timestamptz where id=p_post_id;
 if record_id is not null then
  update public.maintenance_records set data=jsonb_set(data,'{entries}',
   coalesce(data->'entries','[]'::jsonb)
   ||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','status','at',stamp,'employeeNumber',actor.employee_number,'description','Atualizou ação: '||trim(p_title)||E'\nExecutantes: '||coalesce(nullif(next_assigned,''),'Ainda não designados'),'actionPostId',p_post_id,'assignedBefore',previous_assigned,'assignedAfter',next_assigned))),revision=revision+1,updated_at=stamp::timestamptz where id=record_id;
 end if;
 return jsonb_build_object('data',next_data,'revision',post.revision+1);
end $$;
revoke all on function public.edit_maintenance_action(text,text,integer,text[],text) from public,anon;
grant execute on function public.edit_maintenance_action(text,text,integer,text[],text) to authenticated;

-- Preserve calls from an already-open older client while the new interface deploys.
create or replace function public.edit_maintenance_action(p_post_id text,p_title text,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
 select public.edit_maintenance_action(p_post_id,p_title,p_expected_revision,null,null);
$$;
revoke all on function public.edit_maintenance_action(text,text,integer) from public,anon;
grant execute on function public.edit_maintenance_action(text,text,integer) to authenticated;
notify pgrst,'reload schema';


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
