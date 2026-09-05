create or replace function public.edit_maintenance_action(p_post_id text,p_title text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.device_identities; role_name text; post public.operational_wall_posts; record_id uuid; action jsonb; stamp text; previous text; next_data jsonb;
begin
 select * into actor from public.device_identities where auth_user_id=auth.uid();
 select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 if coalesce(role_name,'') not in ('maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager') then raise exception 'Somente inspetores e liderança podem editar a ação';end if;
 if nullif(trim(p_title),'') is null then raise exception 'Informe a finalidade da ação';end if;
 select (data->>'maintenanceRecordId')::uuid into record_id from public.operational_wall_posts where id=p_post_id;
 if record_id is null then raise exception 'Ação técnica não encontrada';end if;
 perform 1 from public.maintenance_records where id=record_id for update;
 select * into post from public.operational_wall_posts where id=p_post_id for update;
 if post.data->>'createdBy' is distinct from actor.employee_number then raise exception 'Somente o autor pode corrigir esta ação';end if;
 if role_name not in ('admin','app_manager','maintenance_manager','maintenance_director') and post.base<>coalesce(actor.assigned_base,'') then raise exception 'Ação fora da sua base';end if;
 if post.revision<>p_expected_revision then raise exception 'Esta ação foi atualizada. Reabra a edição para carregar a versão atual';end if;
 action:=post.data#>'{actions,0}';
 if action is null or jsonb_array_length(post.data->'actions')<>1 then raise exception 'Ação inválida';end if;
 previous:=action->>'title';
 if previous=trim(p_title) then return jsonb_build_object('data',post.data,'revision',post.revision);end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 action:=action||jsonb_build_object('title',trim(p_title),'editedAt',stamp,'editedBy',actor.employee_number,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,
 'edits',coalesce(action->'edits','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',stamp,'employeeNumber',actor.employee_number,'before',previous,'after',trim(p_title))));
 next_data:=post.data||jsonb_build_object('title',trim(p_title),'actions',jsonb_build_array(action),'updatedAt',stamp,'revision',post.revision+1,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,
 'history',coalesce(post.data->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',stamp,'employeeNumber',actor.employee_number,'event','Corrigiu a finalidade da ação')));
 update public.operational_wall_posts set data=next_data,revision=post.revision+1,updated_at=stamp::timestamptz where id=p_post_id;
 update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','status','at',stamp,'employeeNumber',actor.employee_number,'description','Corrigiu ação: '||previous||E'\nNova descrição: '||trim(p_title)))),updated_at=stamp::timestamptz where id=record_id;
 return jsonb_build_object('data',next_data,'revision',post.revision+1);
end $$;
revoke all on function public.edit_maintenance_action(text,text,integer) from public,anon;
grant execute on function public.edit_maintenance_action(text,text,integer) to authenticated;
