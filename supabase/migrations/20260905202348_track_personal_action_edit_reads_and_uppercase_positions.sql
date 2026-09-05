alter table public.wall_read_receipts add column edit_at timestamptz;
do $$ declare definition text;begin
 select pg_get_functiondef('public.mark_wall_read(text,timestamp with time zone,timestamp with time zone)'::regprocedure) into definition;
 definition:=replace(definition,'insert into public.wall_read_receipts values','insert into public.wall_read_receipts(post_id,employee_number,content_at,comments_at) values');
 execute definition;
 select pg_get_functiondef('public.list_maintenance_operation_cards()'::regprocedure) into definition;
 definition:=replace(definition,'''flightId'',f->>''id''','''postId'',f->>''maintenancePostId'',''flightId'',f->>''id''');
 execute definition;
end $$;
create function public.mark_maintenance_edit_read(p_post_id text,p_edited_at timestamptz) returns timestamptz language plpgsql security definer set search_path='' as $$
declare employee text; allowed boolean;stamp timestamptz;latest timestamptz;
begin
 select d.employee_number into employee from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if employee is null or p_edited_at is null then raise exception 'Leitura não autorizada';end if;
 select exists(select 1 from public.operational_wall_posts p join public.device_identities d on d.auth_user_id=auth.uid() join public.authorized_users u using(employee_number) where p.id=p_post_id and u.active and (u.job_role in('admin','app_manager','maintenance_director','maintenance_manager') or u.job_role in('maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant','toolroom') and (p.base='Todas' or p.base=d.assigned_base))) into allowed;
 if not allowed then select exists(select 1 from public.list_maintenance_operation_cards() c where c->>'postId'=p_post_id) into allowed;end if;
 if not allowed then raise exception 'Atividade fora do seu acesso';end if;
 select max((a->>'editedAt')::timestamptz) into latest from public.operational_wall_posts p,jsonb_array_elements(coalesce(p.data->'actions','[]')) a where p.id=p_post_id;
 if latest is null then return null;end if;
 stamp:=least(p_edited_at,latest,now());
 insert into public.wall_read_receipts(post_id,employee_number,edit_at) values(p_post_id,employee,stamp)
 on conflict(post_id,employee_number) do update set edit_at=greatest(wall_read_receipts.edit_at,excluded.edit_at);
 return stamp;
end $$;
revoke all on function public.mark_maintenance_edit_read(text,timestamptz) from public,anon;
grant execute on function public.mark_maintenance_edit_read(text,timestamptz) to authenticated;
create function private.normalize_flight_positions() returns trigger language plpgsql set search_path='' as $$
begin
 new.flights:=coalesce((select jsonb_agg(case when f?'spot' then jsonb_set(f,'{spot}',to_jsonb(upper(coalesce(f->>'spot','')))) else f end order by n) from jsonb_array_elements(new.flights) with ordinality t(f,n)),'[]'::jsonb);
 return new;
end $$;
revoke all on function private.normalize_flight_positions() from public,anon,authenticated;
create trigger normalize_flight_positions before insert or update of flights on public.shared_app_state for each row execute function private.normalize_flight_positions();
