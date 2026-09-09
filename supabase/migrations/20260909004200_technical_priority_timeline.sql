begin;
create function private.publish_technical_priority_change() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor();
begin
 if coalesce(new.technical_case->>'priority',case when new.priority='urgent' then 'urgent' else 'routine' end) is distinct from coalesce(old.technical_case->>'priority',case when old.priority='urgent' then 'urgent' else 'routine' end) then
  update public.operational_wall_posts w set data=jsonb_set(w.data,'{history}',coalesce(w.data->'history','[]')||jsonb_build_array(jsonb_build_object('employeeNumber',a->>'employee','at',clock_timestamp(),'event','Atualizou prioridade do relato técnico'))),revision=w.revision+1,updated_at=clock_timestamp()
  where w.data->>'maintenanceRecordId'=new.id::text and jsonb_array_length(coalesce(w.data->'actions','[]'))=0;
 end if;
 return new;
end $$;
revoke all on function private.publish_technical_priority_change() from public,anon,authenticated;
create trigger zz_technical_priority_timeline after update of technical_case on public.maintenance_records for each row execute function private.publish_technical_priority_change();
commit;
