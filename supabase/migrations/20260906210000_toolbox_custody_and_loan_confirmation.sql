alter table public.toolbox_events drop constraint toolbox_events_status_check;
alter table public.toolbox_events add constraint toolbox_events_status_check check(status in('awaiting_approval','open','returned','confirmed','divergence','cancelled'));
alter table public.toolbox_events add column approved_by text, add column approved_at timestamptz;
alter table public.toolbox_operations add column return_intent_by text, add column return_intent_at timestamptz, add column return_checked_by text;
create table public.toolbox_audit(id bigint generated always as identity primary key,action text not null,target_id uuid,actor text not null,at timestamptz not null default now(),payload jsonb not null);
alter table public.toolbox_audit enable row level security;
revoke all on public.toolbox_audit from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.toolbox_command(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_identity public.device_identities; v_role text; v_box public.toolboxes; v_operation public.toolbox_operations; v_event public.toolbox_events; v_id uuid; v_target text; v_privileged boolean;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','mechanic','maintenance_assistant','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem acesso à Ferramentaria'; end if;
 v_privileged:=v_role in ('admin','app_manager','legacy','toolroom','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector');
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
  if v_operation.id is null or v_operation.assigned_to<>v_identity.employee_number or v_operation.status<>'awaiting_receipt' then raise exception 'Designação inválida'; end if;
  update public.toolbox_operations set status='in_use',accepted_at=now() where id=v_operation.id;
  update public.toolboxes set status='in_use',updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 elsif p_action='take_tool' then
  select o.* into v_operation from public.toolbox_operations o where o.box_id=(p_payload->>'boxId')::uuid and o.status='in_use' and o.return_intent_at is null order by o.created_at desc limit 1 for update;
  if v_operation.id is null then raise exception 'Esta caixa não está em uso'; end if;
  insert into public.toolbox_events(operation_id,event_type,status,employee_number,aircraft_prefix,description,attachments) values(v_operation.id,'withdrawal','awaiting_approval',v_identity.employee_number,upper(trim(p_payload->>'aircraftPrefix')),trim(p_payload->>'description'),coalesce(p_payload->'photos','[]'::jsonb)) returning id into v_id;
 elsif p_action='approve_tool_withdrawal' then
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  select * into v_operation from public.toolbox_operations where id=v_event.operation_id for update;
  if v_event.id is null or v_event.status<>'awaiting_approval' or (not v_privileged and v_operation.assigned_to is distinct from v_identity.employee_number) then raise exception 'Somente o responsável pela caixa ou ferramentaria confirma a retirada';end if;
  if v_operation.status<>'in_use' then raise exception 'Caixa não disponível para empréstimos';end if;
  update public.toolbox_events set status='open',approved_by=v_identity.employee_number,approved_at=now() where id=v_event.id;v_id:=v_event.id;
 elsif p_action='cancel_tool_request' then
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  select * into v_operation from public.toolbox_operations where id=v_event.operation_id for update;
  if v_event.id is null or v_event.status<>'awaiting_approval' or (not v_privileged and v_event.employee_number is distinct from v_identity.employee_number and v_operation.assigned_to is distinct from v_identity.employee_number) then raise exception 'Solicitação inválida';end if;
  update public.toolbox_events set status='cancelled',confirmed_by=v_identity.employee_number,confirmed_at=now() where id=v_event.id;v_id:=v_event.id;
 elsif p_action='request_box_handover' then
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.id is null or v_operation.assigned_to is distinct from v_identity.employee_number or v_operation.status<>'in_use' then raise exception 'Esta caixa não está sob sua responsabilidade';end if;
  if exists(select 1 from public.toolbox_events where operation_id=v_operation.id and status not in('confirmed','cancelled')) then raise exception 'Existem empréstimos ou devoluções pendentes';end if;
  update public.toolbox_operations set return_intent_at=now(),return_intent_by=v_identity.employee_number where id=v_operation.id;v_id:=v_operation.id;
 elsif p_action='mark_tool_returned' then
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  if v_event.id is null or v_event.employee_number<>v_identity.employee_number or v_event.status<>'open' then raise exception 'Retirada inválida'; end if;
  update public.toolbox_events set status='returned',returned_at=now() where id=v_event.id; v_id:=v_event.id;
 elsif p_action='confirm_tool_return' then
  select * into v_event from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
  select * into v_operation from public.toolbox_operations where id=v_event.operation_id for update;
  if not v_privileged and v_operation.assigned_to is distinct from v_identity.employee_number then raise exception 'Somente o responsável pela caixa ou ferramentaria confere a devolução';end if;
  if v_event.id is null or v_event.status<>'returned' then raise exception 'A ferramenta ainda não foi informada como devolvida'; end if;
  update public.toolbox_events set status=case when coalesce((p_payload->>'ok')::boolean,false) then 'confirmed' else 'divergence' end,confirmed_at=now(),confirmed_by=v_identity.employee_number,photo_expires_at=case when coalesce((p_payload->>'ok')::boolean,false) then now()+interval '24 hours' else null end where id=v_event.id; v_id:=v_event.id;
 elsif p_action='request_box_return' then
  if not v_privileged then raise exception 'Somente a ferramentaria ou liderança confere a caixa'; end if;
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.id is null or v_operation.status<>'in_use' or exists(select 1 from public.toolbox_events where operation_id=v_operation.id and status not in ('confirmed','cancelled')) then raise exception 'Existem ferramentas ou divergências pendentes'; end if;
  update public.toolbox_operations set status='awaiting_return_signature',return_requested_at=now(),return_checked_by=v_identity.employee_number where id=v_operation.id;
  update public.toolboxes set status='awaiting_return',updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 elsif p_action='sign_box_return' then
  select * into v_operation from public.toolbox_operations where id=(p_payload->>'operationId')::uuid for update;
  if v_operation.id is null or v_operation.assigned_to<>v_identity.employee_number or v_operation.status<>'awaiting_return_signature' then raise exception 'Designação inválida'; end if;
  if exists(select 1 from public.toolbox_events where operation_id=v_operation.id and status not in('confirmed','cancelled')) then raise exception 'Existem ferramentas pendentes';end if;
  update public.toolbox_operations set status='completed',completed_at=now(),completed_by=v_identity.employee_number,photo_expires_at=now()+interval '24 hours' where id=v_operation.id;
  update public.toolboxes set status='available',responsible_employee_number=null,aircraft_prefix=null,updated_at=now() where id=v_operation.box_id; v_id:=v_operation.id;
 else raise exception 'Ação desconhecida'; end if;
 insert into public.toolbox_audit(action,target_id,actor,payload) values(p_action,v_id,v_identity.employee_number,p_payload-'photos');
 return jsonb_build_object('id',v_id);
end $function$;
