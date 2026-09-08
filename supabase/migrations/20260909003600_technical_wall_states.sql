begin;
create function private.technical_axes(c jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('report',c->>'report','official',c->>'official','aircraft',c->>'aircraft','investigation',c->>'investigation','critical',coalesce((c->>'critical')::boolean,false),'aprsRef',c->>'aprsRef','aprsBy',c->>'aprsBy')
$$;
revoke all on function private.technical_axes(jsonb) from public,anon,authenticated;
do $$
declare f text;
begin
 select pg_get_functiondef('public.publish_maintenance_record_to_wall()'::regprocedure) into f;
 f:=replace(f,'''Pane''','''Relato Técnico''');f:=replace(f,'''Discrepância''','''Relato Técnico''');
 f:=replace(f,'''maintenanceRecordId'',new.id::text','''maintenanceRecordId'',new.id::text,''technicalCase'',private.technical_axes(new.technical_case)');
 execute f;
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'if new.legacy_type is distinct from old.legacy_type then', 'if not coalesce(new.data->''attachments'',''[]'') @> coalesce(old.data->''attachments'',''[]'') then raise exception ''Anexos confirmados devem ser preservados'';end if; if new.legacy_type is distinct from old.legacy_type then');
 execute f;
end $$;
create function private.sync_technical_axes_to_wall() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.operational_wall_posts w set data=w.data||jsonb_build_object('technicalCase',private.technical_axes(new.technical_case)),revision=w.revision+1,updated_at=clock_timestamp()
 where w.data->>'maintenanceRecordId'=new.id::text;
 return new;
end $$;
revoke all on function private.sync_technical_axes_to_wall() from public,anon,authenticated;
create trigger sync_technical_axes_to_wall after update of technical_case on public.maintenance_records for each row execute function private.sync_technical_axes_to_wall();
update public.operational_wall_posts w set data=w.data||jsonb_build_object('technicalCase',private.technical_axes(r.technical_case)) from public.maintenance_records r where w.data->>'maintenanceRecordId'=r.id::text;
commit;
