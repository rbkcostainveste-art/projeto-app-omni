create table if not exists public.compressor_drying_tasks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('runway_handover','wall_action')),
  source_id text not null,
  prefix text not null,
  model text not null default '',
  base text not null default '',
  reason text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  triggered_by text,
  triggered_at timestamptz not null default now(),
  completed_by text,
  completed_at timestamptz,
  unique (source_type,source_id)
);

alter table public.compressor_drying_tasks enable row level security;
revoke all on public.compressor_drying_tasks from anon,authenticated;
grant select on public.compressor_drying_tasks to authenticated;

create policy "operational users read compressor drying queue"
on public.compressor_drying_tasks for select to authenticated
using (exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid())));

create or replace function public.aircraft_model_for_prefix(p_prefix text)
returns text language sql stable security invoker set search_path=public as $$
  select coalesce((select aircraft->>'model' from public.shared_app_state s cross join lateral jsonb_array_elements(s.catalogs->'aircraft') aircraft where s.id='main' and aircraft->>'prefix'=p_prefix limit 1),'');
$$;

create or replace function public.enqueue_drying_from_runway()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.checks->>'compressorWash'='yes' and (tg_op='INSERT' or coalesce(old.checks->>'compressorWash','')<>'yes') then
    insert into public.compressor_drying_tasks(source_type,source_id,prefix,model,base,reason,triggered_by,triggered_at)
    values('runway_handover',new.id::text,new.prefix,new.model,new.base,'Compressores lavados na Passagem de Pista',new.actions->'compressorWash'->>'employeeNumber',coalesce((new.actions->'compressorWash'->>'at')::timestamptz,now()))
    on conflict(source_type,source_id) do update set status='pending',completed_by=null,completed_at=null,triggered_by=excluded.triggered_by,triggered_at=excluded.triggered_at;
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_drying_after_runway_wash on public.runway_handovers;
create trigger enqueue_drying_after_runway_wash after insert or update of checks on public.runway_handovers for each row execute function public.enqueue_drying_from_runway();

create or replace function public.enqueue_drying_from_wall_action()
returns trigger language plpgsql security invoker set search_path=public as $$
declare action jsonb; action_text text; completed boolean;
begin
  for action in select value from jsonb_array_elements(coalesce(new.data->'actions','[]'::jsonb)) loop
    action_text:=lower(concat_ws(' ',new.data->>'category',new.data->>'title',action->>'title'));
    completed:=action->>'status' in ('satisfactory','resolved') or exists(select 1 from jsonb_array_elements(coalesce(action->'executions','[]'::jsonb)) execution where execution->>'result'='satisfactory');
    if completed and (action_text like '%ct disk%' or action_text like '%cp disk%' or action_text like '%lavagem com produto%') then
      insert into public.compressor_drying_tasks(source_type,source_id,prefix,model,base,reason,triggered_by,triggered_at)
      values('wall_action',action->>'id',action->>'prefix',public.aircraft_model_for_prefix(action->>'prefix'),new.base,case when action_text like '%produto%' then 'Lavagem com produto concluída' else 'Lavagem da CT/CP Disk concluída' end,coalesce(new.data->>'maintenanceResultBy',new.data->>'createdBy'),coalesce((new.data->>'maintenanceResultAt')::timestamptz,new.updated_at,now()))
      on conflict(source_type,source_id) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists enqueue_drying_after_wall_action on public.operational_wall_posts;
create trigger enqueue_drying_after_wall_action after insert or update of data on public.operational_wall_posts for each row execute function public.enqueue_drying_from_wall_action();

create or replace function public.complete_compressor_drying(p_task_id uuid)
returns public.compressor_drying_tasks language plpgsql security definer set search_path=public as $$
declare actor public.device_identities%rowtype; result public.compressor_drying_tasks%rowtype;
begin
  select * into actor from public.device_identities d where d.auth_user_id=(select auth.uid()) limit 1;
  if actor.id is null or actor.access_profile not in ('commander','copilot','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Usuário sem permissão para confirmar a secagem'; end if;
  update public.compressor_drying_tasks set status='completed',completed_by=actor.employee_number,completed_at=now() where id=p_task_id and status='pending' returning * into result;
  if result.id is null then raise exception 'Pendência de secagem não encontrada ou já concluída'; end if;
  return result;
end;
$$;

revoke all on function public.complete_compressor_drying(uuid) from public,anon;
grant execute on function public.complete_compressor_drying(uuid) to authenticated;

create index if not exists compressor_drying_tasks_pending_idx on public.compressor_drying_tasks(status,triggered_at desc);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='compressor_drying_tasks') then
    alter publication supabase_realtime add table public.compressor_drying_tasks;
  end if;
end $$;
