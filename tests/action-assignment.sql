-- Synthetic operations only. Run with BEGIN / ROLLBACK (the migration may precede this block).
do $test$
declare actor_id uuid; actor_employee text; actor_base text; mechanic text; role_name text; record public.maintenance_records; post public.operational_wall_posts; result jsonb; linked_id text; standalone_id text; action_id text; blocked boolean; original_author text; allowed integer:=0;
begin
 select d.auth_user_id,d.employee_number,d.assigned_base into actor_id,actor_employee,actor_base from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role in('maintenance_coordinator','maintenance_inspector') and d.assigned_base is not null limit 1;
 if actor_id is null then raise exception 'No maintenance test identity';end if;
 select employee_number into mechanic from public.authorized_users where active and job_role='mechanic' and assigned_base=actor_base limit 1;
 if mechanic is null then raise exception 'No mechanic in test base';end if;
 perform set_config('request.jwt.claim.sub',actor_id::text,true);
 foreach role_name in array array['maintenance_inspector','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager'] loop
  update public.authorized_users set job_role=role_name where employee_number=actor_employee;
  insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
  values(gen_random_uuid(),'fault',actor_base,'S92','PR-QAT','not_logged','open','QA assignment',actor_employee,'{"description":"QA only","entries":[],"technicalCase":true}', '{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage"}') returning * into record;
  linked_id:=public.create_maintenance_request(record.id,'Voo de manutenção','QA linked action','{}','', '{}');
  select * into post from public.operational_wall_posts where id=linked_id;action_id:=post.data#>>'{actions,0,id}';original_author:=post.data->>'createdBy';
  result:=public.edit_maintenance_action(linked_id,'QA updated action',post.revision::integer,array[mechanic],action_id);
  if result#>>'{data,actions,0,assignedTo}'<>mechanic or result#>>'{data,actions,0,title}'<>'QA updated action' then raise exception 'Linked edit failed for %',role_name;end if;
  if result#>>'{data,actions,0,status}'<>'pending' or result#>'{data,actions,0,acknowledgements}'<>'[]'::jsonb or result#>'{data,actions,0,executions}'<>'[]'::jsonb then raise exception 'Assignment invented acknowledgement/execution';end if;
  if result#>>'{data,createdBy}'<>original_author or result#>>'{data,actions,0,edits,0,assignedAfter}'<>mechanic then raise exception 'Authorship/audit lost';end if;
  if not exists(select 1 from public.maintenance_records r,jsonb_array_elements(r.data->'entries') e where r.id=record.id and e->>'actionPostId'=linked_id and e->>'assignedAfter'=mechanic) then raise exception 'Record assignment update missing from history';end if;
  blocked:=false;begin perform public.edit_maintenance_action(linked_id,'Stale',post.revision::integer,'{}',action_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Stale revision accepted';end if;
  select * into post from public.operational_wall_posts where id=linked_id;
  blocked:=false;begin perform public.edit_maintenance_action(linked_id,'Invalid target',post.revision::integer,array['invalid-qa-person'],action_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Invalid assignee accepted';end if;
  result:=public.edit_maintenance_action(linked_id,'QA updated action',post.revision::integer,'{}',action_id);if result#>>'{data,actions,0,assignedTo}'<>'' then raise exception 'Clearing assignment failed';end if;
  standalone_id:=gen_random_uuid()::text;perform public.create_scoped_activity(standalone_id,actor_base,'none','','',null,'Procedimentos','QA standalone','',array[mechanic],'routine','{}','[]');
  select * into post from public.operational_wall_posts where id=standalone_id;
  result:=public.edit_maintenance_action(standalone_id,'QA standalone revised',post.revision::integer,'{}',post.data#>>'{actions,0,id}');if result#>>'{data,actions,0,title}'<>'QA standalone revised' then raise exception 'Independent edit failed for %',role_name;end if;
  allowed:=allowed+1;
 end loop;
 update public.authorized_users set job_role='maintenance_inspector' where employee_number=actor_employee;
 update public.device_identities set assigned_base='Other QA base' where auth_user_id=actor_id;
 select * into post from public.operational_wall_posts where id=linked_id;
 blocked:=false;begin perform public.edit_maintenance_action(linked_id,'Wrong base',post.revision::integer,'{}',action_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Foreign base accepted';end if;
 update public.device_identities set assigned_base=actor_base where auth_user_id=actor_id;
 foreach role_name in array array['mechanic','maintenance_assistant','coordination','toolroom','commander','copilot'] loop
  update public.authorized_users set job_role=role_name where employee_number=actor_employee;
  blocked:=false;begin perform public.create_maintenance_request(record.id,'Procedimentos','Forbidden','{}','','{}');exception when others then blocked:=true;end;if not blocked then raise exception 'Unexpected linked create permission for %',role_name;end if;
  blocked:=false;begin perform public.create_scoped_activity(gen_random_uuid()::text,actor_base,'none','','',null,'Procedimentos','Forbidden','','{}','routine','{}','[]');exception when others then blocked:=true;end;if not blocked then raise exception 'Unexpected create permission for %',role_name;end if;
  blocked:=false;begin perform public.edit_maintenance_action(linked_id,'Forbidden',post.revision::integer,'{}',action_id);exception when others then blocked:=true;end;if not blocked then raise exception 'Unexpected edit permission for %',role_name;end if;
 end loop;
 raise notice 'PASS: % allowed roles, linked and independent creation/edit, assignment/clear/audit, no self-ack or execution, denied roles/base/stale',allowed;
end $test$;
