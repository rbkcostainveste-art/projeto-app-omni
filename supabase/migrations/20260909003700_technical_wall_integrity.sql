begin;
create function private.guard_wall_technical_axes() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.maintenance_records; rid text;
begin
 rid:=new.data->>'maintenanceRecordId';
 if tg_op='UPDATE' and old.data->>'maintenanceRecordId' is not null and rid is distinct from old.data->>'maintenanceRecordId' then raise exception 'O vínculo técnico de origem é imutável';end if;
 if rid is not null then
  select * into r from public.maintenance_records where id=rid::uuid;
  if r.id is null or r.base<>new.base then raise exception 'Vínculo técnico inválido para esta base';end if;
  new.data:=new.data||jsonb_build_object('technicalCase',private.technical_axes(r.technical_case));
 else new.data:=new.data-'technicalCase';end if;
 return new;
end $$;
revoke all on function private.guard_wall_technical_axes() from public,anon,authenticated;
create trigger guard_wall_technical_axes before insert or update on public.operational_wall_posts for each row execute function private.guard_wall_technical_axes();
commit;
