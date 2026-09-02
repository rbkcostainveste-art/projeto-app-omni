alter table public.authorized_users drop constraint if exists authorized_users_job_role_check;
alter table public.authorized_users add constraint authorized_users_job_role_check check (job_role in ('legacy','admin','app_manager','mechanic','toolroom','commander','copilot','flight_attendant','coordination','dispatch','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'));

create or replace function public.set_user_access_context(p_employee_number text,p_access_profile text,p_assigned_base text,p_fleets text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_group text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid();
 if v_identity.auth_user_id is null or not v_identity.is_admin then raise exception 'Somente o administrador altera acessos'; end if;
 if p_access_profile='app_manager' and coalesce(v_identity.job_role,v_identity.access_profile)<>'admin' then raise exception 'Somente o ADM principal concede Gestor App'; end if;
 if p_access_profile not in ('legacy','admin','app_manager','mechanic','toolroom','commander','copilot','flight_attendant','coordination','dispatch','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Função inválida'; end if;
 v_group:=case when p_access_profile in ('commander','copilot','flight_attendant') then 'pilot' when p_access_profile='dispatch' then 'coordination' when p_access_profile in ('maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then 'leader_inspector' when p_access_profile='app_manager' then 'admin' when p_access_profile='toolroom' then 'mechanic' else p_access_profile end;
 update public.authorized_users set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile='maintenance_manager' then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
 update public.device_identities set job_role=p_access_profile,access_profile=v_group,is_admin=(p_access_profile in ('admin','app_manager')),assigned_base=case when p_access_profile='maintenance_manager' then null else nullif(p_assigned_base,'') end,fleets=coalesce(p_fleets,'{}') where employee_number=p_employee_number;
end $$;

create or replace function public.update_user_operational_assignment(p_employee_number text,p_assigned_base text,p_fleets text[],p_mission text,p_work_shift text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_target public.authorized_users; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','coordination','maintenance_manager','maintenance_coordinator') then raise exception 'Sem permissão para alterar designações operacionais'; end if;
 select * into v_target from public.authorized_users where employee_number=p_employee_number and active;
 if v_target.employee_number is null then raise exception 'Usuário não encontrado'; end if;
 if coalesce(v_target.job_role,v_target.access_profile) not in ('mechanic','toolroom','commander','copilot','flight_attendant','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Esta função não possui designação operacional'; end if;
 update public.authorized_users set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
 update public.device_identities set assigned_base=nullif(trim(coalesce(p_assigned_base,'')),''),fleets=coalesce(p_fleets,'{}'),mission=nullif(p_mission,''),work_shift=nullif(p_work_shift,'') where employee_number=p_employee_number;
end $$;

create table public.toolboxes (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  status text not null default 'available' check(status in ('available','awaiting_receipt','in_use','awaiting_return','divergence')),
  responsible_employee_number text references public.authorized_users(employee_number),
  aircraft_prefix text, created_by text not null references public.authorized_users(employee_number),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.toolbox_operations (
  id uuid primary key default gen_random_uuid(), box_id uuid not null references public.toolboxes(id) on delete cascade,
  status text not null check(status in ('awaiting_receipt','in_use','awaiting_return_signature','completed','divergence')),
  assigned_to text not null references public.authorized_users(employee_number), aircraft_prefix text,
  notes text not null default '', photos jsonb not null default '[]', created_by text not null,
  created_at timestamptz not null default now(), accepted_at timestamptz, return_requested_at timestamptz,
  completed_at timestamptz, completed_by text, photo_expires_at timestamptz
);
create table public.toolbox_events (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.toolbox_operations(id) on delete cascade,
  event_type text not null check(event_type in ('withdrawal','return')),
  status text not null default 'open' check(status in ('open','returned','confirmed','divergence')),
  employee_number text not null references public.authorized_users(employee_number), aircraft_prefix text,
  description text not null, attachments jsonb not null default '[]', created_at timestamptz not null default now(),
  returned_at timestamptz, confirmed_at timestamptz, confirmed_by text, photo_expires_at timestamptz
);
create index toolbox_operations_box_status_idx on public.toolbox_operations(box_id,status);
create index toolbox_operations_assigned_status_idx on public.toolbox_operations(assigned_to,status);
create index toolbox_events_operation_status_idx on public.toolbox_events(operation_id,status);
alter table public.toolboxes enable row level security;
alter table public.toolbox_operations enable row level security;
alter table public.toolbox_events enable row level security;
revoke all on public.toolboxes,public.toolbox_operations,public.toolbox_events from anon,authenticated;

create or replace function public.purge_expired_toolbox_photos()
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.toolbox_operations set photos='[]'::jsonb where photo_expires_at<=now() and photos<>'[]'::jsonb;
 update public.toolbox_events set attachments='[]'::jsonb where photo_expires_at<=now() and attachments<>'[]'::jsonb;
end $$;

create or replace function public.get_toolbox_dashboard()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','mechanic','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem acesso à Ferramentaria'; end if;
 perform public.purge_expired_toolbox_photos();
 return jsonb_build_object(
  'boxes',coalesce((select jsonb_agg(to_jsonb(b) order by b.code) from public.toolboxes b),'[]'::jsonb),
  'operations',coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from public.toolbox_operations o),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.toolbox_events e),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(jsonb_build_object('employeeNumber',u.employee_number,'name',u.display_name,'role',coalesce(u.job_role,u.access_profile)) order by u.display_name) from public.authorized_users u where u.active),'[]'::jsonb)
 );
end $$;

create or replace function public.toolbox_command(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text; v_box public.toolboxes; v_operation public.toolbox_operations; v_event public.toolbox_events; v_id uuid; v_target text; v_privileged boolean;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','mechanic','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem acesso à Ferramentaria'; end if;
 v_privileged:=v_role in ('admin','app_manager','legacy','toolroom','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector');
 if p_action='create_box' then
  if not v_privileged then raise exception 'Somente a ferramentaria ou liderança cadastra caixas'; end if;
  insert into public.toolboxes(code,name,created_by) values(upper(trim(p_payload->>'code')),trim(p_payload->>'name'),v_identity.employee_number) returning id into v_id;
 elsif p_action='assign_box' then
  if not v_privileged then raise exception 'Somente a ferramentaria ou liderança entrega caixas'; end if;
  select * into v_box from public.toolboxes where id=(p_payload->>'boxId')::uuid for update;
  if v_box.id is null or v_box.status<>'available' then raise exception 'Caixa indisponível'; end if;
  v_target:=trim(p_payload->>'assignedTo'); if not exists(select 1 from public.authorized_users where employee_number=v_target and active) then raise exception 'Colaborador não encontrado'; end if;
  insert into public.toolbox_operations(box_id,status,assigned_to,aircraft_prefix,notes,photos,created_by) values(v_box.id,'awaiting_receipt',v_target,nullif(upper(trim(p_payload->>'aircraftPrefix')),''),coalesce(p_payload->>'notes',''),coalesce(p_payload->'photos','[]'::jsonb),v_identity.employee_number) returning id into v_id;
  update public.toolboxes set status='awaiting_receipt',responsible_employee_number=v_target,aircraft_prefix=nullif(upper(trim(p_payload->>'aircraftPrefix')),''),updated_at=now() where id=v_box.id;
 elsif p_action='accept_box' then
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.assigned_to<>v_identity.employee_number or v_operation.status<>'awaiting_receipt' then raise exception 'Designação inválida'; end if;
  update public.toolbox_operations set status='in_use',accepted_at=now() where id=v_operation.id;
  update public.toolboxes set status='in_use',updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 elsif p_action='take_tool' then
  select o.* into v_operation from public.toolbox_operations o where o.box_id=(p_payload->>'boxId')::uuid and o.status in ('in_use','awaiting_return_signature') order by o.created_at desc limit 1;
  if v_operation.id is null then raise exception 'Esta caixa não está em uso'; end if;
  insert into public.toolbox_events(operation_id,event_type,status,employee_number,aircraft_prefix,description,attachments) values(v_operation.id,'withdrawal','open',v_identity.employee_number,upper(trim(p_payload->>'aircraftPrefix')),trim(p_payload->>'description'),coalesce(p_payload->'photos','[]'::jsonb)) returning id into v_id;
 elsif p_action='mark_tool_returned' then
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  if v_event.employee_number<>v_identity.employee_number or v_event.status<>'open' then raise exception 'Retirada inválida'; end if;
  update public.toolbox_events set status='returned',returned_at=now() where id=v_event.id; v_id:=v_event.id;
 elsif p_action='confirm_tool_return' then
  if not v_privileged then raise exception 'Somente a ferramentaria ou liderança confirma devoluções'; end if;
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  if v_event.status<>'returned' then raise exception 'A ferramenta ainda não foi informada como devolvida'; end if;
  update public.toolbox_events set status=case when coalesce((p_payload->>'ok')::boolean,false) then 'confirmed' else 'divergence' end,confirmed_at=now(),confirmed_by=v_identity.employee_number,photo_expires_at=case when coalesce((p_payload->>'ok')::boolean,false) then now()+interval '24 hours' else null end where id=v_event.id; v_id:=v_event.id;
 elsif p_action='request_box_return' then
  if not v_privileged then raise exception 'Somente a ferramentaria ou liderança confere a caixa'; end if;
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.status<>'in_use' or exists(select 1 from public.toolbox_events where operation_id=v_operation.id and status in ('open','returned','divergence')) then raise exception 'Existem ferramentas ou divergências pendentes'; end if;
  update public.toolbox_operations set status='awaiting_return_signature',return_requested_at=now() where id=v_operation.id;
  update public.toolboxes set status='awaiting_return',updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 elsif p_action='sign_box_return' then
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.assigned_to<>v_identity.employee_number or v_operation.status<>'awaiting_return_signature' then raise exception 'Designação inválida'; end if;
  update public.toolbox_operations set status='completed',completed_at=now(),completed_by=v_identity.employee_number,photo_expires_at=now()+interval '24 hours' where id=v_operation.id;
  update public.toolboxes set status='available',responsible_employee_number=null,aircraft_prefix=null,updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 else raise exception 'Ação desconhecida'; end if;
 return jsonb_build_object('id',v_id);
end $$;

create or replace function public.purge_expired_toolbox_photos()
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.toolbox_operations set photos='[]'::jsonb where photo_expires_at<=now() and photos<>'[]'::jsonb;
 update public.toolbox_events set attachments='[]'::jsonb where photo_expires_at<=now() and attachments<>'[]'::jsonb;
end $$;

revoke all on function public.get_toolbox_dashboard(),public.toolbox_command(text,jsonb),public.purge_expired_toolbox_photos() from public,anon;
grant execute on function public.get_toolbox_dashboard(),public.toolbox_command(text,jsonb) to authenticated;

do $$ begin
 if exists(select 1 from cron.job where jobname='purge-toolbox-photos') then perform cron.unschedule('purge-toolbox-photos'); end if;
 perform cron.schedule('purge-toolbox-photos','17 * * * *','select public.purge_expired_toolbox_photos()');
end $$;
