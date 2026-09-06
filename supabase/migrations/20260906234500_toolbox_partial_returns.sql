alter table public.toolbox_events add column source_event_id uuid references public.toolbox_events(id);
alter function public.toolbox_command(text,jsonb) rename to toolbox_command_before_partial;
revoke all on function public.toolbox_command_before_partial(text,jsonb) from public,anon,authenticated;

create function public.toolbox_command(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.toolbox_events; actor text; chosen jsonb; returned_tools jsonb; remaining_tools jsonb; child_id uuid; returned_names text; remaining_names text;
begin
 if p_action<>'mark_tool_returned' or not(p_payload ? 'toolIds') then return public.toolbox_command_before_partial(p_action,p_payload);end if;
 select employee_number into actor from public.device_identities where auth_user_id=auth.uid();
 if actor is null then raise exception 'Sem acesso';end if;
 select * into ev from public.toolbox_events where id=(p_payload->>'eventId')::uuid;
 perform 1 from public.toolbox_operations where id=ev.operation_id for update;
 select * into ev from public.toolbox_events where id=(p_payload->>'eventId')::uuid for update;
 if ev.id is null or ev.employee_number<>actor or ev.status<>'open' then raise exception 'Retirada inválida para devolução';end if;
 chosen:=p_payload->'toolIds';
 if jsonb_typeof(chosen)<>'array' then raise exception 'Seleção inválida';end if;
 if jsonb_array_length(chosen)=0 or jsonb_array_length(chosen)<>(select count(distinct value) from jsonb_array_elements_text(chosen)) then raise exception 'Selecione as ferramentas devolvidas, sem repetições';end if;
 if exists(select 1 from jsonb_array_elements_text(chosen) c where not exists(select 1 from jsonb_array_elements(ev.tool_refs) t where t->>'id'=c.value)) then raise exception 'Ferramenta não pertence a esta retirada ou já foi devolvida';end if;
 if jsonb_array_length(chosen)=jsonb_array_length(ev.tool_refs) then return public.toolbox_command_before_partial(p_action,p_payload);end if;
 select coalesce(jsonb_agg(t),'[]') into returned_tools from jsonb_array_elements(ev.tool_refs) t where chosen ? (t->>'id');
 select coalesce(jsonb_agg(t),'[]') into remaining_tools from jsonb_array_elements(ev.tool_refs) t where not(chosen ? (t->>'id'));
 select string_agg(concat_ws(' ',t->>'name',t->>'measure')||' · '||(t->>'drawer'),E'\n') into returned_names from jsonb_array_elements(returned_tools) t;
 select string_agg(concat_ws(' ',t->>'name',t->>'measure')||' · '||(t->>'drawer'),E'\n') into remaining_names from jsonb_array_elements(remaining_tools) t;
 insert into public.toolbox_events(operation_id,event_type,status,employee_number,aircraft_prefix,description,attachments,created_at,returned_at,approved_by,approved_at,tool_refs,source_event_id)
 values(ev.operation_id,'return','returned',actor,ev.aircraft_prefix,returned_names,ev.attachments,ev.created_at,now(),ev.approved_by,ev.approved_at,returned_tools,ev.id) returning id into child_id;
 update public.toolbox_events set tool_refs=remaining_tools,description=remaining_names where id=ev.id;
 insert into public.toolbox_audit(action,target_id,actor,payload) values('partial_tool_return',ev.id,actor,jsonb_build_object('before',ev.tool_refs,'remaining',remaining_tools,'returned',returned_tools,'returnEventId',child_id,'aircraftPrefix',ev.aircraft_prefix));
 return jsonb_build_object('id',child_id);
end $$;
revoke all on function public.toolbox_command(text,jsonb) from public,anon;
grant execute on function public.toolbox_command(text,jsonb) to authenticated;
