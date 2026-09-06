create or replace function public.toolbox_command(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.toolbox_operations; ev public.toolbox_events; actor text; selected jsonb; snapshot jsonb:='[]'; tool jsonb; drawer jsonb; ident text; result jsonb; names text:=''; b uuid;
begin
 select employee_number into actor from public.device_identities where auth_user_id=auth.uid();if actor is null then raise exception 'Sem acesso';end if;
 if p_action in('assign_box','request_box_return') and not exists(select 1 from public.device_identities where auth_user_id=auth.uid() and coalesce(job_role,access_profile)='toolroom') then raise exception 'Somente a ferramentaria empresta e recebe caixas completas';end if;
 if p_action='request_box_handover' then raise exception 'A ferramentaria inicia o recebimento da caixa';end if;
 if p_action in('approve_tool_withdrawal','confirm_tool_return','cancel_tool_request') then
  select * into ev from public.toolbox_events where id=(p_payload->>'eventId')::uuid;
  select * into op from public.toolbox_operations where id=ev.operation_id;
  if ev.id is null or (op.assigned_to is distinct from actor and not(p_action='cancel_tool_request' and ev.employee_number=actor)) then raise exception 'Somente o responsável pela caixa confirma movimentações de suas ferramentas';end if;
 end if;
 if p_action='assign_box' then
  perform 1 from public.toolboxes where id=(p_payload->>'boxId')::uuid for update;
  if exists(select 1 from public.toolboxes where id=(p_payload->>'boxId')::uuid and transfer_to is not null) then raise exception 'Caixa em transferência';end if;
 end if;
 if p_action in('take_tool','correct_tool_selection') then
  if p_action='correct_tool_selection' then
   select * into ev from public.toolbox_events where id=(p_payload->>'eventId')::uuid;
   if ev.id is null or ev.employee_number<>actor or ev.status not in('awaiting_approval','open') then raise exception 'Esta retirada não permite correção';end if;
   select * into op from public.toolbox_operations where id=ev.operation_id for update;
   select * into ev from public.toolbox_events where id=ev.id for update;
   if ev.status not in('awaiting_approval','open') then raise exception 'Retirada alterada; atualize a tela';end if;
  else
   select * into op from public.toolbox_operations where box_id=(p_payload->>'boxId')::uuid and status='in_use' for update;
  end if;
  if op.id is null or op.return_intent_at is not null then raise exception 'Caixa indisponível';end if;b:=op.box_id;
  selected:=coalesce(p_payload->'toolIds','[]');
  if exists(select 1 from public.toolbox_visual_catalog where box_id=b and jsonb_array_length(drawers)>0) and jsonb_array_length(selected)=0 then raise exception 'Selecione as ferramentas no catálogo da gaveta';end if;
  if jsonb_typeof(selected)<>'array' or jsonb_array_length(selected)>100 then raise exception 'Seleção inválida';end if;
  for ident in select value from jsonb_array_elements_text(selected) loop
   select d.value,t.value into drawer,tool from public.toolbox_visual_catalog c cross join lateral jsonb_array_elements(c.drawers) d cross join lateral jsonb_array_elements(d.value->'tools') t where c.box_id=b and t.value->>'id'=ident and (d.value->>'reviewed')::boolean and (t.value->>'reviewed')::boolean;
   if tool is null then raise exception 'Ferramenta não encontrada ou ainda não conferida';end if;
   if exists(select 1 from jsonb_array_elements(snapshot) s where s->>'id'=ident) then raise exception 'Ferramenta duplicada';end if;
   if exists(select 1 from public.toolbox_events e join public.toolbox_operations o on o.id=e.operation_id cross join lateral jsonb_array_elements(e.tool_refs) r where o.box_id=b and e.status not in('confirmed','cancelled') and e.id is distinct from ev.id and r->>'id'=ident) then raise exception 'Ferramenta já reservada ou emprestada. Atualize a gaveta';end if;
   snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',ident,'name',tool->>'name','measure',tool->>'measure','drawer',drawer->>'name','boxId',b));
   names:=names||case when names='' then '' else E'\n' end||(tool->>'name')||' '||coalesce(tool->>'measure','')||' · '||(drawer->>'name');
  end loop;
  if p_action='correct_tool_selection' then
   if jsonb_array_length(snapshot)=0 or nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Selecione ferramentas e informe o motivo da correção';end if;
   insert into public.toolbox_audit(action,target_id,actor,payload) values('correct_tool_selection',ev.id,actor,jsonb_build_object('before',ev.tool_refs,'after',snapshot,'reason',p_payload->>'reason'));
   update public.toolbox_events set tool_refs=snapshot,description=names,status='awaiting_approval',approved_by=null,approved_at=null where id=ev.id;
   return jsonb_build_object('id',ev.id);
  end if;
  result:=public.toolbox_command_legacy(p_action,case when jsonb_array_length(snapshot)>0 then p_payload||jsonb_build_object('description',names) else p_payload end);
  update public.toolbox_events set tool_refs=snapshot where id=(result->>'id')::uuid;return result;
 end if;
 return public.toolbox_command_legacy(p_action,p_payload);
end $$;
