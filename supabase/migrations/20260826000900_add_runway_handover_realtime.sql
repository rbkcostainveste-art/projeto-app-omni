alter table public.shared_app_state
  add column if not exists passages jsonb not null default '[]'::jsonb;

create or replace function public.save_shared_state(p_flights jsonb,p_catalogs jsonb,p_passages jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.shared_app_state; v_revision bigint; begin
select * into v_identity from public.device_identities where auth_user_id=auth.uid(); if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
select * into v_current from public.shared_app_state where id='main' for update; if v_current.id is null and not v_identity.is_admin then raise exception 'O administrador precisa iniciar a sincronização'; end if;
if v_current.id is not null and not v_identity.is_admin then
  if p_catalogs<>v_current.catalogs then raise exception 'Somente o administrador altera cadastros'; end if;
  if exists(select 1 from jsonb_array_elements(v_current.flights) old where not exists(select 1 from jsonb_array_elements(p_flights) new where new->>'id'=old->>'id')) then raise exception 'Somente o administrador exclui voos'; end if;
  if exists(select 1 from jsonb_array_elements(v_current.passages) old where not exists(select 1 from jsonb_array_elements(p_passages) new where new->>'id'=old->>'id')) then raise exception 'Somente o administrador exclui passagens'; end if;
end if;
insert into public.shared_app_state(id,flights,catalogs,passages,revision,updated_by,updated_at) values('main',p_flights,p_catalogs,p_passages,1,v_identity.employee_number,now()) on conflict(id) do update set flights=excluded.flights,catalogs=excluded.catalogs,passages=excluded.passages,revision=public.shared_app_state.revision+1,updated_by=excluded.updated_by,updated_at=now() returning revision into v_revision;
if v_identity.is_admin then insert into public.authorized_users(employee_number,display_name,password_hash,is_admin) select item->>'employeeNumber',item->>'name',extensions.crypt('1234',extensions.gen_salt('bf')),false from jsonb_array_elements(coalesce(p_catalogs->'users','[]')) item where nullif(item->>'employeeNumber','') is not null on conflict(employee_number) do update set display_name=excluded.display_name,active=true; end if;
return v_revision; end $$;

create or replace function public.save_shared_state(p_flights jsonb,p_catalogs jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare v_passages jsonb; begin
select passages into v_passages from public.shared_app_state where id='main';
return public.save_shared_state(p_flights,p_catalogs,coalesce(v_passages,'[]'::jsonb));
end $$;

revoke all on function public.save_shared_state(jsonb,jsonb,jsonb),public.save_shared_state(jsonb,jsonb) from public,anon;
grant execute on function public.save_shared_state(jsonb,jsonb,jsonb),public.save_shared_state(jsonb,jsonb) to authenticated;
