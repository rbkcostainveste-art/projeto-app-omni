create or replace function public.can_read_coordination_activity(p_base text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number)
 where d.auth_user_id=(select auth.uid()) and u.active and u.job_role='coordination'
 and (d.assigned_base is null or p_base='Todas' or p_base=d.assigned_base));
$$;
revoke all on function public.can_read_coordination_activity(text) from public,anon;
grant execute on function public.can_read_coordination_activity(text) to authenticated;
alter policy "coordination reads maintenance activities" on public.operational_wall_posts using (
 audience_area='maintenance' and jsonb_array_length(coalesce(data->'actions','[]'::jsonb))>0
 and public.can_read_coordination_activity(base));
