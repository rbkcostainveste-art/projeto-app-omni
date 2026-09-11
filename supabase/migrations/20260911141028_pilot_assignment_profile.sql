CREATE OR REPLACE FUNCTION public.get_operational_assignments()
 RETURNS TABLE(employee_number text, display_name text, access_profile text, assigned_base text, fleets text[], mission text, work_shift text, avatar_data_url text, active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_identity public.device_identities; begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid();
 if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','coordination','leader_inspector','mechanic','pilot','commander','copilot','flight_attendant')) then raise exception 'Sem permissão para consultar pessoas'; end if;
 return query select u.employee_number,u.display_name,coalesce(u.job_role,u.access_profile),u.assigned_base,u.fleets,u.mission,u.work_shift,u.avatar_data_url,u.active from public.authorized_users u where u.active and (v_identity.is_admin or v_identity.access_profile not in ('pilot','commander','copilot','flight_attendant') or u.employee_number=v_identity.employee_number) order by u.display_name,u.employee_number;
end $function$;
