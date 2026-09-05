-- Carry maintenance urgency into the shared operational card.
do $$ declare definition text;begin
 select pg_get_functiondef('private.sync_maintenance_operation()'::regprocedure) into definition;
 definition:=replace(definition,'''maintenanceCategory'',new.data->>''category''',
 '''maintenancePriority'',case when new.data->>''priority''=''critical'' then ''critical'' when origin.priority in (''urgent'',''logged'') or new.data->>''priority''=''urgent'' then ''urgent'' else coalesce(new.data->>''priority'',''routine'') end,''maintenanceCategory'',new.data->>''category''');
 execute definition;
end $$;
-- Hide orphaned cards while preserving their events and audit trail.
create or replace function private.retire_removed_maintenance_cards() returns trigger language plpgsql security definer set search_path='' as $$
declare source_id text; source_data jsonb; remaining jsonb; changed jsonb;stamp text;
begin
 source_id:=old.id;source_data:=case when tg_op='DELETE' then '{}'::jsonb else new.data end;
 remaining:=case when source_data->>'category' in ('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT Disk','Lavagem com produto') then coalesce(source_data->'actions','[]') else '[]'::jsonb end;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 perform 1 from public.shared_app_state where id='main' for update;
 select jsonb_agg(case when f->>'maintenancePostId'=source_id and coalesce(f->>'deletedAt','')='' and not exists(select 1 from jsonb_array_elements(remaining) a where a->>'id'=f->>'maintenanceActionId')
 then f||jsonb_build_object('deletedAt',stamp,'maintenanceSourceDeleted',true,'deletedBy',coalesce((select employee_number from public.device_identities where auth_user_id=auth.uid()),'system'),'revision',coalesce((f->>'revision')::int,0)+1)
 else f end order by n) into changed from public.shared_app_state s,jsonb_array_elements(s.flights) with ordinality t(f,n) where s.id='main';
 update public.shared_app_state set flights=changed,revision=revision+1,updated_at=now() where id='main' and changed is not null and flights is distinct from changed;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.retire_removed_maintenance_cards() from public,anon,authenticated;
create trigger retire_removed_maintenance_cards after update of data or delete on public.operational_wall_posts for each row execute function private.retire_removed_maintenance_cards();
-- Refresh existing linked cards without creating events.
do $$ declare r record;begin
 for r in select id,data->>'createdBy' employee from public.operational_wall_posts where jsonb_array_length(coalesce(data->'actions','[]'))>0 loop
 perform set_config('request.jwt.claim.sub',coalesce((select auth_user_id::text from public.device_identities where employee_number=r.employee limit 1),''),true);
 update public.operational_wall_posts set data=data where id=r.id;
 end loop;
end $$;
