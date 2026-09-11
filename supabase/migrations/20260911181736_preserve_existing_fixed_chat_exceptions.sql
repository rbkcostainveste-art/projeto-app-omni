do $$
declare definition text;
begin
 select pg_get_functiondef('public.chat_fixed_group(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,
 'if not exists(select 1 from public.authorized_users where employee_number=emp and active and (global_access or assigned_base=actor.assigned_base)) then',
 'if not (p_action=''update'' and coalesce(c.audience->''included'',''[]'') ? emp) and not exists(select 1 from public.authorized_users where employee_number=emp and active and (global_access or assigned_base=actor.assigned_base)) then');
 execute definition;
end $$;
