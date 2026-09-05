create table public.wall_read_receipts(post_id text not null references public.operational_wall_posts(id) on delete cascade,employee_number text not null,content_at timestamptz,comments_at timestamptz,primary key(post_id,employee_number));
alter table public.wall_read_receipts enable row level security;
grant select on public.wall_read_receipts to authenticated;
create policy "read own wall receipts" on public.wall_read_receipts for select to authenticated using(employee_number=(select employee_number from public.device_identities where auth_user_id=(select auth.uid())));
create or replace function public.mark_wall_read(p_post_id text,p_content_at timestamptz,p_comments_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare employee text;allowed boolean;begin
 select employee_number into employee from public.device_identities where auth_user_id=auth.uid();if employee is null then raise exception 'Usuário não identificado';end if;
 -- Do not expose receipt writes for posts outside the reader's maintenance/base scope.
 select exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u using(employee_number) where p.id=p_post_id and u.active and (u.job_role in('admin','app_manager','maintenance_director','maintenance_manager') or u.job_role in('maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant','toolroom') and (p.base='Todas' or p.base=d.assigned_base))) into allowed;
 if not allowed then raise exception 'Publicação fora do seu acesso';end if;
 insert into public.wall_read_receipts values(p_post_id,employee,least(p_content_at,now()),least(p_comments_at,now())) on conflict(post_id,employee_number) do update set content_at=greatest(wall_read_receipts.content_at,excluded.content_at),comments_at=greatest(wall_read_receipts.comments_at,excluded.comments_at);
end $$;
revoke all on function public.mark_wall_read(text,timestamptz,timestamptz) from public,anon;
grant execute on function public.mark_wall_read(text,timestamptz,timestamptz) to authenticated;
create or replace function public.pin_wall_comment(p_post_id text,p_comment_id text) returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities; role_name text;p public.operational_wall_posts;begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente liderança fixa orientações';end if;
 select * into p from public.operational_wall_posts where id=p_post_id for update;
 if p.id is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and p.base<>coalesce(d.assigned_base,'')) then raise exception 'Publicação fora da base';end if;
 if p_comment_id is not null and not exists(select 1 from jsonb_array_elements(p.data->'comments') c where c->>'id'=p_comment_id) then raise exception 'Comentário não encontrado';end if;
 update public.operational_wall_posts set data=data||jsonb_build_object('pinnedCommentId',p_comment_id),revision=revision+1,updated_at=now() where id=p_post_id;
end $$;
revoke all on function public.pin_wall_comment(text,text) from public,anon;grant execute on function public.pin_wall_comment(text,text) to authenticated;
create or replace function public.record_maintenance_task_result(p_post_id text,p_description text,p_result text,p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities;role_name text;p public.operational_wall_posts;r uuid;a jsonb;stamp text; entry jsonb;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada registra resultado';end if;
 if nullif(trim(p_description),'') is null or p_result not in('satisfactory','nonconforming') or p_result is null then raise exception 'Informe descrição e resultado';end if;
 select (data->>'maintenanceRecordId')::uuid into r from public.operational_wall_posts where id=p_post_id;
 perform 1 from public.maintenance_records where id=r for update;
 select * into p from public.operational_wall_posts where id=p_post_id for update;
 if p.id is null or (role_name not in('maintenance_director','maintenance_manager') and p.base<>coalesce(d.assigned_base,'')) then raise exception 'Tarefa fora da base';end if;
 a:=p.data#>'{actions,0}';if a is null then raise exception 'Tarefa indisponível';end if;
 if role_name='mechanic' and nullif(a->>'assignedTo','') is not null and not d.employee_number=any(regexp_split_to_array(a->>'assignedTo','\s*,\s*')) then raise exception 'Tarefa atribuída a outro executante';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(a->'executions','[]')) e where e->>'id'=p_request_id::text) then return;end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 entry:=jsonb_build_object('id',p_request_id,'employeeNumber',d.employee_number,'at',stamp,'description',trim(p_description),'result',p_result,'attachments','[]'::jsonb);
 a:=a||jsonb_build_object('status',p_result,'executions',coalesce(a->'executions','[]')||jsonb_build_array(entry));
 update public.operational_wall_posts set data=data||jsonb_build_object('actions',jsonb_build_array(a)),revision=revision+1,updated_at=now() where id=p_post_id;
 entry:=entry||jsonb_build_object('kind','action','actionPostId',p_post_id,'description',(p.data->>'category')||' — '||(a->>'title')||E'\nResultado: '||trim(p_description));
 update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]')||jsonb_build_array(entry)),updated_at=now() where id=r;
end $$;
revoke all on function public.record_maintenance_task_result(text,text,text,uuid) from public,anon;grant execute on function public.record_maintenance_task_result(text,text,text,uuid) to authenticated;
-- An execution updates only its own task and the parent notice, not every task on the same fault.
do $$ declare definition text;begin
 select pg_get_functiondef('public.sync_maintenance_result_to_wall()'::regprocedure) into definition;
 definition:=replace(definition,'where wall.data->>''maintenanceRecordId''=new.id::text','where wall.data->>''maintenanceRecordId''=new.id::text and (jsonb_array_length(coalesce(wall.data->''actions'',''[]''))=0 or wall.id=v_entry->>''actionPostId'')');execute definition;
end $$;
create or replace function public.get_comment_author_roles() returns table(employee_number text,job_role text) language sql stable security definer set search_path='' as $$
 select u.employee_number,u.job_role from public.authorized_users u where u.active and exists(select 1 from public.device_identities d join public.authorized_users reader using(employee_number) where d.auth_user_id=(select auth.uid()) and reader.active);
$$;
revoke all on function public.get_comment_author_roles() from public,anon;grant execute on function public.get_comment_author_roles() to authenticated;
