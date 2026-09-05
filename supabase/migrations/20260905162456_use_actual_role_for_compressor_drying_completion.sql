do $$ declare definition text; begin
select pg_get_functiondef('public.complete_compressor_drying(uuid)'::regprocedure) into definition;
definition:=replace(definition,'actor.access_profile not in (','not exists(select 1 from public.authorized_users u where u.employee_number=actor.employee_number and u.active and u.job_role in (');
definition:=replace(definition,$a$'maintenance_inspector') then$a$,$b$'maintenance_inspector')) then$b$);
if position('u.job_role' in definition)=0 then raise exception 'Role update failed';end if;
execute definition;
end $$;
