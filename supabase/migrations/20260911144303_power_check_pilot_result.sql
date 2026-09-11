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
 cross join lateral (select value f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'prefix'=a->>'prefix' and value->>'base'=p.base and value->>'date'>=to_char(p.created_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') and (coalesce(value->>'actualShutdown',value->>'operationEndedAt','')='' or coalesce(value->>'operationEndedAt',value->>'actualShutdown','')>=p.created_at::text) and value->>'maintenancePostId' is null and coalesce(value->>'cancelled','false')<>'true' and coalesce(value->>'deletedAt','')='' order by value->>'date',value->>'departure',value->>'id' limit 1) selected
 where u.active and u.job_role in('commander','copilot') and d.employee_number in(f->>'commander',f->>'copilot') and not p.resolved
 and lower(p.data->>'category') ='power check' and coalesce(a->>'status','pending') not in('satisfactory','resolved','closed','ok');
$function$;

CREATE OR REPLACE FUNCTION public.record_maintenance_task_result(p_post_id text, p_description text, p_result text, p_request_id uuid, p_attachments jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.device_identities;role_name text;p public.operational_wall_posts;r uuid;a jsonb;stamp text; entry jsonb;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in('commander','copilot','mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada registra resultado';end if;
 if nullif(trim(p_description),'') is null or p_result not in('satisfactory','nonconforming') or p_result is null then raise exception 'Informe descrição e resultado';end if;
 select (data->>'maintenanceRecordId')::uuid into r from public.operational_wall_posts where id=p_post_id;
 perform 1 from public.maintenance_records where id=r for update;
 select * into p from public.operational_wall_posts where id=p_post_id for update;
 if p.id is null then raise exception 'Tarefa não encontrada';end if;
 if role_name in('commander','copilot') then
  if p.data->>'category'<>'Power Check' or not exists(select 1 from public.list_crew_maintenance_actions() card join public.shared_app_state s on s.id='main' cross join lateral jsonb_array_elements(s.flights) f where card->>'postId'=p_post_id and f->>'id'=card->>'flightId' and (f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null or nullif(f->>'operationEndedAt','') is not null)) then raise exception 'Confirme o Power Check após o retorno do voo em que você está escalado';end if;
  if d.signature_verified_at is null or d.signature_verified_at<now()-interval '1 minute' then raise exception 'Confirme sua assinatura';end if;
 elsif role_name not in('maintenance_director','maintenance_manager') and p.base<>coalesce(d.assigned_base,'') then raise exception 'Tarefa fora da base';end if;
 a:=p.data#>'{actions,0}';if a is null then raise exception 'Tarefa indisponível';end if;

 if exists(select 1 from jsonb_array_elements(coalesce(a->'executions','[]')) e where e->>'id'=p_request_id::text) then return;end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 entry:=jsonb_build_object('id',p_request_id,'employeeNumber',d.employee_number,'at',stamp,'description',trim(p_description),'result',p_result,'attachments',coalesce(p_attachments,'[]'::jsonb));
 a:=a||jsonb_build_object('status',p_result,'executions',coalesce(a->'executions','[]')||jsonb_build_array(entry));
 update public.operational_wall_posts set data=data||jsonb_build_object('actions',jsonb_build_array(a)),revision=revision+1,updated_at=now() where id=p_post_id;
 entry:=entry||jsonb_build_object('kind','action','actionPostId',p_post_id,'description',(p.data->>'category')||' — '||(a->>'title')||E'\nResultado: '||trim(p_description));
 update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]')||jsonb_build_array(entry)),updated_at=now() where id=r;
end $function$;

CREATE OR REPLACE FUNCTION private.enforce_wall_area_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_identity public.device_identities; v_area text:=coalesce(new.audience_area,old.audience_area); begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (
    v_identity.is_admin or v_identity.access_profile='legacy' or
    v_area='general' or
    v_area='pilots' and v_identity.access_profile='pilot' or
    v_area='coordination' and v_identity.access_profile='coordination' or
    v_area='maintenance' and v_identity.access_profile='leader_inspector' or
    v_area='maintenance' and v_identity.access_profile='pilot'
    and old.data->>'category'='Power Check'
    and new.base=old.base and new.resolved=old.resolved
    and new.data-'actions'=old.data-'actions'
    and jsonb_array_length(new.data->'actions')=1
    and (new.data#>'{actions,0}')-array['status','executions']=(old.data#>'{actions,0}')-array['status','executions']
    and new.data#>>'{actions,0,status}' in('satisfactory','nonconforming')
    and jsonb_array_length(new.data#>'{actions,0,executions}')=jsonb_array_length(coalesce(old.data#>'{actions,0,executions}','[]'))+1
    and (new.data#>'{actions,0,executions}')-(-1)=coalesce(old.data#>'{actions,0,executions}','[]')
    and new.data#>>'{actions,0,executions,-1,employeeNumber}'=v_identity.employee_number
    and new.data#>>'{actions,0,executions,-1,result}'=new.data#>>'{actions,0,status}'
    and v_identity.signature_verified_at>now()-interval '1 minute'
    and exists(select 1 from public.list_crew_maintenance_actions() card join public.shared_app_state s on s.id='main' cross join lateral jsonb_array_elements(s.flights) f where card->>'postId'=old.id and f->>'id'=card->>'flightId' and (f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null or nullif(f->>'operationEndedAt','') is not null))
    or
    v_area='maintenance' and v_identity.access_profile='mechanic' and (new.base='Todas' or v_identity.assigned_base is null or new.base=v_identity.assigned_base)
  ) then raise exception 'Publicação fora da sua área de acesso'; end if;
  return new;
end $function$;
