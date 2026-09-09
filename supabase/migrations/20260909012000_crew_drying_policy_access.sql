create or replace function private.can_read_compressor_drying(p_prefix text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=auth.uid() and u.active and
 (u.job_role not in('commander','copilot','flight_attendant') or
 private.current_aircraft_base(p_prefix)=private.current_crew_base()))
$$;
revoke all on function private.can_read_compressor_drying(text) from public,anon;
grant execute on function private.can_read_compressor_drying(text) to authenticated;
drop policy "operational users read compressor drying queue" on public.compressor_drying_tasks;
create policy "operational users read compressor drying queue" on public.compressor_drying_tasks for select to authenticated
using(private.can_read_compressor_drying(prefix));
