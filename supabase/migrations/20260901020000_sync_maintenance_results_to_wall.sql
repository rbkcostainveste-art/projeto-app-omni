create or replace function public.sync_maintenance_result_to_wall()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_entry_id text;
  v_result text;
  v_at text;
  v_actor text;
  v_event text;
begin
  select entry into v_entry
  from jsonb_array_elements(coalesce(new.data->'entries','[]'::jsonb)) entry
  where entry->>'kind'='action' and entry->>'result' in ('satisfactory','nonconforming')
  order by (entry->>'at')::timestamptz desc
  limit 1;

  if v_entry is null then return new; end if;
  v_entry_id:=v_entry->>'id';
  v_result:=v_entry->>'result';
  v_at:=coalesce(v_entry->>'at',now()::text);
  v_actor:=coalesce(v_entry->>'employeeNumber',new.created_by);
  v_event:=case when v_result='satisfactory' then 'Registrou ação · OK' else 'Registrou ação · Não OK' end;

  update public.operational_wall_posts wall
  set data=(wall.data || jsonb_build_object(
      'maintenanceResult',v_result,
      'maintenanceResultAt',v_at,
      'maintenanceResultBy',v_actor,
      'maintenanceResultDescription',coalesce(v_entry->>'description',''),
      'lastMaintenanceEntryId',v_entry_id,
      'updatedAt',v_at,
      'revision',wall.revision+1,
      'history',coalesce(wall.data->'history','[]'::jsonb) || jsonb_build_array(jsonb_build_object('employeeNumber',v_actor,'at',v_at,'event',v_event))
    )),
    revision=wall.revision+1,
    updated_at=(v_at::timestamptz)
  where wall.data->>'maintenanceRecordId'=new.id::text
    and coalesce(wall.data->>'lastMaintenanceEntryId','')<>v_entry_id;

  return new;
end;
$$;

revoke all on function public.sync_maintenance_result_to_wall() from public,anon,authenticated;

drop trigger if exists sync_maintenance_result_to_wall on public.maintenance_records;
create trigger sync_maintenance_result_to_wall
after update of data on public.maintenance_records
for each row execute function public.sync_maintenance_result_to_wall();
