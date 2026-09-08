create table public.chat_inbox_updates(employee_number text primary key,revision bigint not null default 1,updated_at timestamptz not null default now());
alter table public.chat_inbox_updates enable row level security;
revoke all on public.chat_inbox_updates from anon,authenticated;
grant select on public.chat_inbox_updates to authenticated;
create policy "own chat updates" on public.chat_inbox_updates for select to authenticated using(exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=(select auth.uid()) and u.active and d.employee_number=chat_inbox_updates.employee_number));
create function private.notify_chat_inbox() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.chat_inbox_updates(employee_number) select employee_number from public.internal_conversation_members where conversation_id=new.conversation_id
 on conflict(employee_number) do update set revision=public.chat_inbox_updates.revision+1,updated_at=clock_timestamp();
 return new;end $$;
revoke all on function private.notify_chat_inbox() from public,anon,authenticated;
create trigger notify_chat_inbox after insert on public.internal_messages for each row execute function private.notify_chat_inbox();
alter publication supabase_realtime add table public.chat_inbox_updates;
alter table public.chat_push_jobs add column delivery_status text,add column last_error text;
