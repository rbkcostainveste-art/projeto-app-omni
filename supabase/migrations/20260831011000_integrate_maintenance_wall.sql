drop policy if exists "maintenance creates technical records" on public.maintenance_records;
create policy "maintenance creates technical records" on public.maintenance_records for insert to authenticated with check (
  exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()) and d.employee_number=maintenance_records.created_by and (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector')) and (record_type<>'inspection' or d.is_admin or d.access_profile in ('legacy','leader_inspector')))
);

create or replace function public.publish_maintenance_record_to_wall()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_wall_id text:=gen_random_uuid()::text; v_at text:=now()::text; v_label text; v_priority text; v_data jsonb; begin
  if not (new.record_type='fault' or new.record_type='discrepancy' and new.priority='urgent') then return new; end if;
  v_label:=case new.record_type when 'fault' then 'Pane' else 'Discrepância' end;
  v_priority:=case when new.priority='urgent' then 'urgent' else 'routine' end;
  v_data:=jsonb_build_object('id',v_wall_id,'title',v_label||' · '||new.prefix||' · '||new.title,'body',coalesce(new.data->>'description',''),'base',new.base,'audienceArea','maintenance','category',v_label,'priority',v_priority,'pinned',false,'essential',false,'resolved',false,'createdBy',new.created_by,'createdAt',v_at,'updatedAt',v_at,'revision',1,'attachments','[]'::jsonb,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('employeeNumber',new.created_by,'at',v_at,'event','Criou '||lower(v_label))),'actions','[]'::jsonb,'maintenanceRecordId',new.id::text);
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data) values(v_wall_id,new.base,'maintenance',false,false,false,v_data);
  return new;
end $$;
drop trigger if exists publish_maintenance_record_to_wall on public.maintenance_records;
create trigger publish_maintenance_record_to_wall after insert on public.maintenance_records for each row execute function public.publish_maintenance_record_to_wall();

create or replace function public.create_wall_action_from_maintenance_record(p_record_id uuid,p_category text,p_title text,p_assigned_to text[])
returns text language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_record public.maintenance_records; v_wall_id text:=gen_random_uuid()::text; v_action_id text:=gen_random_uuid()::text; v_at text:=now()::text; v_data jsonb; begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null or not (v_identity.is_admin or v_identity.access_profile in ('legacy','mechanic','leader_inspector')) then raise exception 'Sem acesso à manutenção'; end if;
  select * into v_record from public.maintenance_records where id=p_record_id;
  if v_record.id is null then raise exception 'Registro não encontrado'; end if;
  v_data:=jsonb_build_object('id',v_wall_id,'title',trim(p_title),'body','Origem: '||case v_record.record_type when 'fault' then 'Pane' when 'discrepancy' then 'Discrepância' else 'Inspeção programada' end||' '||v_record.prefix||' — '||v_record.title,'base',v_record.base,'audienceArea','maintenance','category',p_category,'priority',case when v_record.priority='urgent' then 'urgent' else 'routine' end,'pinned',false,'essential',false,'resolved',false,'createdBy',v_identity.employee_number,'createdAt',v_at,'updatedAt',v_at,'revision',1,'attachments','[]'::jsonb,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('employeeNumber',v_identity.employee_number,'at',v_at,'event','Criou ação de manutenção a partir do registro técnico')),'actions',jsonb_build_array(jsonb_build_object('id',v_action_id,'prefix',v_record.prefix,'title',trim(p_title),'description','Vinculada ao registro '||v_record.id::text,'assignedTo',array_to_string(coalesce(p_assigned_to,'{}'),', '),'status','pending','views','[]'::jsonb,'acknowledgements','[]'::jsonb,'executions','[]'::jsonb,'createdAt',v_at)),'maintenanceRecordId',v_record.id::text);
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data) values(v_wall_id,v_record.base,'maintenance',false,false,false,v_data);
  return v_wall_id;
end $$;
revoke all on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[]) from public,anon;
grant execute on function public.create_wall_action_from_maintenance_record(uuid,text,text,text[]) to authenticated;
