alter table public.authorized_users add column if not exists password_hash text, add column if not exists is_admin boolean not null default false;
update public.authorized_users set password_hash=extensions.crypt('1234',extensions.gen_salt('bf')) where password_hash is null;
insert into public.authorized_users(employee_number,display_name,password_hash,is_admin) values('0001','Administrador',extensions.crypt('1234',extensions.gen_salt('bf')),true) on conflict(employee_number) do update set is_admin=true;
alter table public.authorized_users alter column password_hash set not null;

create table public.device_identities(auth_user_id uuid primary key references auth.users(id) on delete cascade,employee_number text not null references public.authorized_users(employee_number),is_admin boolean not null default false,claimed_at timestamptz not null default now());
create table public.shared_app_state(id text primary key,flights jsonb not null default '[]',catalogs jsonb not null default '{}',revision bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now());
alter table public.device_identities enable row level security;
alter table public.shared_app_state enable row level security;
revoke all on public.device_identities,public.shared_app_state from anon,authenticated;
grant select on public.device_identities,public.shared_app_state to authenticated;
create policy "devices read own identity" on public.device_identities for select to authenticated using ((select auth.uid())=auth_user_id);
create policy "claimed devices read shared state" on public.shared_app_state for select to authenticated using (exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid())));

create or replace function public.claim_device_identity(p_employee_number text,p_password text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
if v_uid is null then raise exception 'Sessão inválida'; end if;
select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
insert into public.device_identities(auth_user_id,employee_number,is_admin) values(v_uid,v_user.employee_number,v_user.is_admin) on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,claimed_at=now();
return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin); end $$;

create or replace function public.save_shared_state(p_flights jsonb,p_catalogs jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.shared_app_state; v_revision bigint; begin
select * into v_identity from public.device_identities where auth_user_id=auth.uid(); if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
select * into v_current from public.shared_app_state where id='main' for update; if v_current.id is null and not v_identity.is_admin then raise exception 'O administrador precisa iniciar a sincronização'; end if;
if v_current.id is not null and not v_identity.is_admin then if p_catalogs<>v_current.catalogs then raise exception 'Somente o administrador altera cadastros'; end if; if exists(select 1 from jsonb_array_elements(v_current.flights) old where not exists(select 1 from jsonb_array_elements(p_flights) new where new->>'id'=old->>'id')) then raise exception 'Somente o administrador exclui voos'; end if; end if;
insert into public.shared_app_state(id,flights,catalogs,revision,updated_by,updated_at) values('main',p_flights,p_catalogs,1,v_identity.employee_number,now()) on conflict(id) do update set flights=excluded.flights,catalogs=excluded.catalogs,revision=public.shared_app_state.revision+1,updated_by=excluded.updated_by,updated_at=now() returning revision into v_revision;
if v_identity.is_admin then insert into public.authorized_users(employee_number,display_name,password_hash,is_admin) select item->>'employeeNumber',item->>'name',extensions.crypt('1234',extensions.gen_salt('bf')),false from jsonb_array_elements(coalesce(p_catalogs->'users','[]')) item where nullif(item->>'employeeNumber','') is not null on conflict(employee_number) do update set display_name=excluded.display_name,active=true; end if;
return v_revision; end $$;

revoke all on function public.claim_device_identity(text,text),public.save_shared_state(jsonb,jsonb) from public,anon;
grant execute on function public.claim_device_identity(text,text),public.save_shared_state(jsonb,jsonb) to authenticated;
create index if not exists device_identities_employee_number_idx on public.device_identities(employee_number);
do $$ begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_app_state') then alter publication supabase_realtime add table public.shared_app_state; end if; end $$;
