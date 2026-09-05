do $$ declare definition text;begin
select pg_get_functiondef('public.record_maintenance_task_result(text,text,text,uuid)'::regprocedure) into definition;
definition:=replace(definition,'p_request_id uuid)','p_request_id uuid, p_attachments jsonb DEFAULT ''[]''::jsonb)');
definition:=replace(definition,'''attachments'',''[]''::jsonb','''attachments'',coalesce(p_attachments,''[]''::jsonb)');
execute definition;
end $$;
drop function public.record_maintenance_task_result(text,text,text,uuid);
revoke all on function public.record_maintenance_task_result(text,text,text,uuid,jsonb) from public,anon;
grant execute on function public.record_maintenance_task_result(text,text,text,uuid,jsonb) to authenticated;
do $$ declare definition text;begin
select pg_get_functiondef('private.sync_maintenance_operation()'::regprocedure) into definition;
definition:=replace(definition,' or nullif(new.data->>''maintenanceRecordId'','''') is null','');
definition:=replace(definition,'''maintenanceOriginTitle'',origin.title','''maintenanceOriginTitle'',coalesce(origin.title,''Atividade de manutenção'')');
execute definition;
select pg_get_functiondef('public.configure_maintenance_operation(text,jsonb)'::regprocedure) into definition;
definition:=replace(definition,'value->>''maintenancePostId''=p_post_id;','value->>''maintenancePostId''=p_post_id and (not(p_plan?''flightId'') or value->>''id''=p_plan->>''flightId'');');
execute definition;
end $$;
do $$ declare r record;begin
for r in select id,data->>'createdBy' employee from public.operational_wall_posts where data->>'maintenanceRecordId' is null and jsonb_array_length(coalesce(data->'actions','[]'))>0 loop
perform set_config('request.jwt.claim.sub',coalesce((select auth_user_id::text from public.device_identities where employee_number=r.employee limit 1),''),true);
update public.operational_wall_posts set data=data where id=r.id;
end loop;
end $$;
