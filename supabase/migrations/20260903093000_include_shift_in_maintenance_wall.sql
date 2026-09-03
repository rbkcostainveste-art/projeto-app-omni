create or replace function public.publish_maintenance_record_to_wall()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_wall_id text:=gen_random_uuid()::text; v_at text:=now()::text; v_label text; v_priority text; v_data jsonb;
begin
  if not (new.record_type='fault' or new.record_type='discrepancy' and new.priority='urgent') then return new; end if;
  v_label:=case new.record_type when 'fault' then 'Pane' else 'Discrepância' end;
  v_priority:=case when new.priority='urgent' then 'urgent' else 'routine' end;
  v_data:=jsonb_build_object(
    'id',v_wall_id,'ticketCode',new.ticket_code,'title',v_label||' · '||new.prefix||' · '||new.title,
    'body',coalesce(new.data->>'description',''),'base',new.base,'audienceArea','maintenance','category',v_label,
    'priority',v_priority,'pinned',false,'essential',false,'resolved',false,'createdBy',new.created_by,
    'createdAt',v_at,'updatedAt',v_at,'revision',1,'attachments','[]'::jsonb,'views','[]'::jsonb,
    'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,
    'history',jsonb_build_array(jsonb_build_object('employeeNumber',new.created_by,'at',v_at,'event','Criou '||lower(v_label))),
    'actions','[]'::jsonb,'maintenanceRecordId',new.id::text,
    'originShift',new.data->>'originShift','originMission',new.data->>'originMission'
  );
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data)
  values(v_wall_id,new.base,'maintenance',false,false,false,v_data);
  return new;
end $$;
revoke all on function public.publish_maintenance_record_to_wall() from public,anon,authenticated;
