CREATE OR REPLACE FUNCTION public.list_crew_maintenance_actions()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select card from public.list_maintenance_operation_cards() card
 where exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and u.job_role in('commander','copilot'))
 and (card->>'status'='pending' or card->>'date'=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'))
 union all
 select jsonb_build_object('id',a->>'id','postId',p.id,'flightId',f->>'id','date',f->>'date','prefix',a->>'prefix','category',case when lower(p.data->>'category')='lavagem da ct disk' then 'Lavagem da CT disk' else p.data->>'category' end,'title',a->>'title','description',coalesce(r.title,'Atividade de manutenção'),'status',coalesce(a->>'status','pending'),'createdAt',a->>'createdAt','commander',f->>'commander','copilot',f->>'copilot','standalone',false)
 from public.operational_wall_posts p cross join lateral jsonb_array_elements(coalesce(p.data->'actions','[]')) a
 left join public.maintenance_records r on r.id::text=p.data->>'maintenanceRecordId'
 join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u using(employee_number)
 cross join lateral (select value f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix'=a->>'prefix' and value->>'base'=p.base and value->>'date'>=to_char(p.created_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') and (coalesce(value->>'actualShutdown',value->>'operationEndedAt','')='' or coalesce(nullif(value->>'operationEndedAt','')::timestamptz,case when nullif(value->>'actualShutdown','') is not null then ((value->>'date')||'T'||(value->>'actualShutdown'))::timestamp at time zone 'America/Sao_Paulo' end)>=p.created_at) and value->>'maintenancePostId' is null and coalesce(value->>'cancelled','false')<>'true' and coalesce(value->>'deletedAt','')='' order by value->>'date',value->>'departure',value->>'id' limit 1) selected
 where u.active and u.job_role in('commander','copilot') and d.employee_number in(f->>'commander',f->>'copilot') and not p.resolved
 and lower(p.data->>'category') ='power check' and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok');
$function$;
