create table public.authorized_users (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.authorized_users enable row level security;
revoke all on table public.authorized_users from anon;
grant select, insert, update, delete on table public.authorized_users to authenticated;

create policy "authenticated users can read authorized users"
on public.authorized_users for select to authenticated
using ((select auth.uid()) is not null);

create policy "admins can insert authorized users"
on public.authorized_users for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

create policy "admins can update authorized users"
on public.authorized_users for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

create policy "admins can delete authorized users"
on public.authorized_users for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

insert into public.authorized_users (employee_number, display_name)
values ('1024', 'Operador de teste'), ('1031', 'Operador 1031'), ('1048', 'Operador 1048')
on conflict (employee_number) do nothing;
