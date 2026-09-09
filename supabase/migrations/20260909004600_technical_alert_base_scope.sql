begin;
-- Match the existing maintenance base scope when selecting automatic recipients.
create function private.technical_recipients_for_base(p_base text) returns table(employee text)
language sql stable security definer set search_path='' as $$
 select e.employee from private.technical_recipients() e join public.authorized_users u on u.employee_number=e.employee
 where u.access_profile in('admin','app_manager') or u.job_role in('maintenance_manager','maintenance_director')
 or nullif(u.assigned_base,'') is null or u.assigned_base=p_base
$$;
revoke all on function private.technical_recipients_for_base(text) from public,anon,authenticated;
do $$ declare f text;begin
 select pg_get_functiondef('private.audit_technical_case()'::regprocedure) into f;
 f:=replace(f,'private.technical_recipients() e','private.technical_recipients_for_base(new.base) e');execute f;
 select pg_get_functiondef('private.technical_deadline_alerts()'::regprocedure) into f;
 f:=replace(f,'private.technical_recipients() e','private.technical_recipients_for_base(r.base) e');execute f;
end $$;
insert into public.technical_case_audit(event,actor_role,reason,new_value)
values('operator_policy_update','migration','Regra solicitada pelo operador: inspetores e superiores da manutenção, e mecânicos com designação APRS explícita; alertas respeitam base.',
 '{"technicalRoles":["maintenance_inspector","maintenance_coordinator","maintenance_manager","maintenance_director"],"mechanicDesignation":"aprsMechanics","actionGeneration":"leadership_only"}');
commit;
