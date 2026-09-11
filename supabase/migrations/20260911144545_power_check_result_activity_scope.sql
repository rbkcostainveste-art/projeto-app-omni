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
 if role_name in('commander','copilot') then return;end if;
 entry:=entry||jsonb_build_object('kind','action','actionPostId',p_post_id,'description',(p.data->>'category')||' — '||(a->>'title')||E'\nResultado: '||trim(p_description));
 update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]')||jsonb_build_array(entry)),updated_at=now() where id=r;
end $function$;
