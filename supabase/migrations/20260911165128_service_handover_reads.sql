create table public.service_handover_reads (
 employee_number text not null,
 record_id uuid not null references public.maintenance_records(id) on delete cascade,
 revision bigint not null,
 seen_at timestamptz not null default now(),
 primary key(employee_number,record_id)
);
alter table public.service_handover_reads enable row level security;
revoke all on public.service_handover_reads from public,anon,authenticated;
create or replace function public.service_handover_read(p_items jsonb default '[]')
returns table(record_id uuid,revision bigint)
language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); selection jsonb; r public.maintenance_records;
begin
 if auth.uid() is null or a is null or nullif(a->>'employee','') is null then raise exception 'Identificação necessária';end if;
 if coalesce(a->>'role','') not in ('admin','app_manager','mechanic','maintenance_assistant','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem acesso à passagem de serviço';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then raise exception 'Selecione até 100 registros';end if;
 for selection in select value from jsonb_array_elements(p_items) order by value->>'id' loop
  select * into r from public.maintenance_records m where m.id=(selection->>'id')::uuid for share;
  if r.id is null then raise exception 'Registro não encontrado';end if;
  if a->>'role' not in ('admin','app_manager','maintenance_director','maintenance_manager') and r.base<>coalesce(a->>'base','') then raise exception 'Registro fora da sua base';end if;
  if r.revision is distinct from (selection->>'revision')::bigint then raise exception 'O registro mudou. Atualize e leia a nova intervenção';end if;
  insert into public.service_handover_reads as receipt(employee_number,record_id,revision)
  values(a->>'employee',r.id,r.revision)
  on conflict(employee_number,record_id) do update set revision=excluded.revision,seen_at=now();
 end loop;
 return query select receipt.record_id,receipt.revision from public.service_handover_reads receipt
 join public.maintenance_records m on m.id=receipt.record_id
 where receipt.employee_number=a->>'employee' and (a->>'role' in ('admin','app_manager','maintenance_director','maintenance_manager') or m.base=coalesce(a->>'base',''));
end $$;
revoke all on function public.service_handover_read(jsonb) from public,anon;
grant execute on function public.service_handover_read(jsonb) to authenticated;
