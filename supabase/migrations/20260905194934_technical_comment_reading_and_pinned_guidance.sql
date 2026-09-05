create table public.technical_comment_reads(record_id uuid not null references public.maintenance_records(id) on delete cascade,employee_number text not null,seen_at timestamptz not null,primary key(record_id,employee_number));
alter table public.technical_comment_reads enable row level security;
grant select on public.technical_comment_reads to authenticated;
create policy "read own technical comment receipts" on public.technical_comment_reads for select to authenticated using(employee_number=(select employee_number from public.device_identities where auth_user_id=(select auth.uid())));
create or replace function public.read_technical_comments(p_record_id uuid,p_seen_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities;role_name text;b text;begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;select base into b from public.maintenance_records where id=p_record_id;
 if coalesce(role_name,'') not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector','mechanic','maintenance_assistant','toolroom') or b is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and b<>coalesce(d.assigned_base,'')) then raise exception 'Registro fora do seu acesso';end if;
 if p_seen_at is null then return;end if;
 insert into public.technical_comment_reads values(p_record_id,d.employee_number,least(p_seen_at,now())) on conflict(record_id,employee_number) do update set seen_at=greatest(technical_comment_reads.seen_at,excluded.seen_at);
end $$;
revoke all on function public.read_technical_comments(uuid,timestamptz) from public,anon;grant execute on function public.read_technical_comments(uuid,timestamptz) to authenticated;
create or replace function public.pin_technical_comment(p_record_id uuid,p_comment_id text) returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities;role_name text;r public.maintenance_records;begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;select * into r from public.maintenance_records where id=p_record_id for update;
 if coalesce(role_name,'') not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') or r.id is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and r.base<>coalesce(d.assigned_base,'')) then raise exception 'Registro fora do seu acesso';end if;
 if p_comment_id is not null and not exists(select 1 from jsonb_array_elements(r.data->'entries') e where e->>'id'=p_comment_id and e->>'kind'='comment') then raise exception 'Comentário não encontrado';end if;
 update public.maintenance_records set data=data||jsonb_build_object('pinnedCommentId',p_comment_id),updated_at=now() where id=p_record_id;
end $$;
revoke all on function public.pin_technical_comment(uuid,text) from public,anon;grant execute on function public.pin_technical_comment(uuid,text) to authenticated;
