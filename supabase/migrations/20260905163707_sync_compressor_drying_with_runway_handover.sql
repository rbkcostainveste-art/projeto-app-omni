create or replace function private.reset_drying_after_new_wash()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.checks->>'compressorWash'='yes' and (tg_op='INSERT' or coalesce(old.checks->>'compressorWash','')<>'yes') then
  new.checks:=jsonb_set(new.checks,'{dryingRun}','"pending"');
  new.actions:=coalesce(new.actions,'{}')-'dryingRun';
 end if;
 return new;
end $$;
revoke all on function private.reset_drying_after_new_wash() from public,anon,authenticated;
create trigger reset_drying_before_new_wash before insert or update of checks on public.runway_handovers for each row execute function private.reset_drying_after_new_wash();

create or replace function private.sync_drying_completion_to_runway()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and old.status is distinct from new.status and new.source_type='runway_handover' then
  update public.runway_handovers set
   checks=jsonb_set(checks,'{dryingRun}','"yes"'),
   actions=jsonb_set(coalesce(actions,'{}'),'{dryingRun}',jsonb_build_object('employeeNumber',new.completed_by,'at',new.completed_at)),
   updated_at=new.completed_at,revision=revision+1
  where id=new.source_id and checks->>'dryingRun' is distinct from 'yes';
 end if;
 return new;
end $$;
revoke all on function private.sync_drying_completion_to_runway() from public,anon,authenticated;
create trigger sync_drying_completion_to_runway after update of status on public.compressor_drying_tasks for each row execute function private.sync_drying_completion_to_runway();

create or replace function private.sync_runway_drying_completion()
returns trigger language plpgsql security definer set search_path='' as $$
declare employee text; role_name text;
begin
 if new.checks->>'dryingRun'='yes' and (tg_op='INSERT' or old.checks->>'dryingRun' is distinct from 'yes') then
  -- The reverse update already holds the task as completed; do not write it again.
  if not exists(select 1 from public.compressor_drying_tasks where source_type='runway_handover' and source_id=new.id and status='pending') then return new;end if;
  select u.employee_number,u.job_role into employee,role_name from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
  if employee is null or role_name is null or role_name not in ('mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente manutenção habilitada confirma o giro na passagem';end if;
  update public.compressor_drying_tasks set status='completed',completed_by=employee,completed_at=now()
   where source_type='runway_handover' and source_id=new.id and status='pending';
 end if;
 return new;
end $$;
revoke all on function private.sync_runway_drying_completion() from public,anon,authenticated;
create trigger sync_runway_drying_completion after insert or update of checks on public.runway_handovers for each row execute function private.sync_runway_drying_completion();

do $$ declare definition text;begin
 select pg_get_functiondef('public.complete_compressor_drying(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'update public.compressor_drying_tasks set', $lock$perform 1 from public.runway_handovers where id=(select source_id from public.compressor_drying_tasks where id=p_task_id and source_type='runway_handover') for update; update public.compressor_drying_tasks set$lock$);
 execute definition;
end $$;
