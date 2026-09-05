create or replace function public.list_crew_maintenance_actions()
returns setof jsonb language sql stable security definer set search_path='' as $$
 select action || jsonb_build_object('category',p.data->>'category','base',p.base)
 from public.operational_wall_posts p
 cross join lateral jsonb_array_elements(coalesce(p.data->'actions','[]'::jsonb)) action
 join public.device_identities d on d.auth_user_id=(select auth.uid())
 join public.authorized_users u on u.employee_number=d.employee_number and u.active
 where u.job_role in ('commander','copilot','pilot')
 and (p.base='Todas' or p.base=d.assigned_base)
 and p.data->>'category' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT Disk','Lavagem com produto')
 and not p.resolved
 and (
   d.employee_number=any(regexp_split_to_array(coalesce(action->>'assignedTo',''), '\s*,\s*'))
   or exists(select 1 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) f
     where s.id='main' and f->>'prefix'=action->>'prefix' and f->>'base'=d.assigned_base
     and f->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')
     and coalesce(f->>'deletedAt','')='' and coalesce(f->>'cancelled','false')<>'true'
     and d.employee_number in (f->>'commander',f->>'copilot'))
 )
 and (coalesce(action->>'status','pending') not in ('satisfactory','resolved','closed','ok')
   or (action->>'createdAt')::timestamptz >= date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;
revoke all on function public.list_crew_maintenance_actions() from public,anon;
grant execute on function public.list_crew_maintenance_actions() to authenticated;

alter policy "coordination reads maintenance activities" on public.operational_wall_posts using (
 audience_area='maintenance' and data->>'category' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT Disk','Lavagem com produto')
 and jsonb_array_length(coalesce(data->'actions','[]'::jsonb))>0
 and public.can_read_coordination_activity(base));
