drop function if exists public.create_wall_action_from_maintenance_record(uuid,text,text,text[]);
revoke all on function public.publish_maintenance_record_to_wall() from public,anon,authenticated;
