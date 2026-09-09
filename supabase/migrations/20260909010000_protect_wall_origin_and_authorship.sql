-- Mirrored publications are controlled by their source, never independently deleted.
create or replace function private.guard_wall_origin_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if tg_op='UPDATE' then
  if new.data->>'createdBy' is distinct from old.data->>'createdBy'
    or new.data->>'maintenanceRecordId' is distinct from old.data->>'maintenanceRecordId' then
   raise exception 'Autoria e vínculo de origem da publicação são imutáveis';
  end if;
  return new;
 end if;
 if nullif(old.data->>'maintenanceRecordId','') is not null then
  if exists(select 1 from public.maintenance_records where id::text=old.data->>'maintenanceRecordId') then
   raise exception 'Esta publicação acompanha o registro de origem e não pode ser apagada pelo mural';
  end if;
  -- Source removal may propagate through a database trigger, not a direct client call.
  if pg_trigger_depth()>1 then return old;end if;
  raise exception 'A remoção deve ocorrer pela origem';
 end if;
 select d.employee_number into actor from public.device_identities d join public.authorized_users u on u.employee_number=d.employee_number and u.active where d.auth_user_id=auth.uid();
 if actor is null or actor is distinct from old.data->>'createdBy' then
  raise exception 'Você não pode apagar um registro criado por outra pessoa';
 end if;
 return old;
end $$;
revoke all on function private.guard_wall_origin_deletion() from public,anon,authenticated;
create trigger protect_wall_origin before update of data or delete on public.operational_wall_posts
for each row execute function private.guard_wall_origin_deletion();

create or replace function public.delete_own_operational_wall_post(p_id text)
returns void language plpgsql security definer set search_path='' as $$
declare actor text; post public.operational_wall_posts;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u on u.employee_number=d.employee_number and u.active where d.auth_user_id=auth.uid();
 if actor is null then raise exception 'Sessão não autorizada';end if;
 select * into post from public.operational_wall_posts where id=p_id for update;
 if post.id is null then raise exception 'Publicação não encontrada';end if;
 if actor is distinct from post.data->>'createdBy' then raise exception 'Você não pode apagar um registro criado por outra pessoa';end if;
 if nullif(post.data->>'maintenanceRecordId','') is not null then raise exception 'Esta publicação acompanha o registro de origem e não pode ser apagada pelo mural';end if;
 delete from public.operational_wall_posts where id=p_id;
end $$;
revoke all on function public.delete_own_operational_wall_post(text) from public,anon;
grant execute on function public.delete_own_operational_wall_post(text) to authenticated;

-- Keep confirmed technical records and their audit history; close via the technical flow.
create or replace function public.delete_maintenance_record(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin raise exception 'Registros técnicos confirmados são preservados. Use encerramento ou cancelamento com motivo na origem.';end $$;

-- Closure is reserved to inspectors and maintenance superiors, even with an APRS mechanic designation.
do $$ declare definition text;begin
 select pg_get_functiondef('private.technical_allowed(text)'::regprocedure) into definition;
 definition:=replace(definition,
 'select capability=any(',
 'select (capability<>''close'' or a->>''role'' in(''maintenance_inspector'',''maintenance_coordinator'',''maintenance_manager'',''maintenance_director'')) and capability=any(');
 execute definition;
end $$;
