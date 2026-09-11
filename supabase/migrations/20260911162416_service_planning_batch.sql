-- Preserve the shift of each intervention, independently of future roster changes.
create or replace function private.stamp_service_intervention() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.device_identities; u public.authorized_users; e jsonb; previous jsonb:='[]'; entries jsonb:='[]';
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into u from public.authorized_users where employee_number=d.employee_number and active;
 if tg_op='UPDATE' then previous:=coalesce(old.data->'entries','[]');end if;
 for e in select value from jsonb_array_elements(coalesce(new.data->'entries','[]')) loop
  if not previous @> jsonb_build_array(e) then
   e:=e||jsonb_build_object('workShift',u.work_shift,'mission',u.mission);
   if e->>'kind'='assignment' and not(e ? 'assignedTo') then e:=e||jsonb_build_object('assignedTo',coalesce(new.data->'assignedTo','[]'));end if;
  end if;
  entries:=entries||jsonb_build_array(e);
 end loop;
 new.data:=new.data||jsonb_build_object('entries',entries);
 if d.auth_user_id is not null then new.data:=new.data||jsonb_build_object('lastWorkShift',u.work_shift,'lastMission',u.mission,'lastUpdatedBy',d.employee_number);end if;
 return new;
end $$;
create trigger aab_stamp_service_intervention before insert or update on public.maintenance_records for each row execute function private.stamp_service_intervention();

create or replace function public.service_planning_batch(p_items jsonb,p_action text,p_assigned text[] default '{}',p_text text default '') returns integer language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); d public.device_identities; r public.maintenance_records; selection jsonb; entry jsonb; next_data jsonb; count_changed integer:=0; manager boolean; stamp timestamptz:=clock_timestamp();
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 if a is null or coalesce(a->>'role','') not in('admin','app_manager','mechanic','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem acesso à passagem de serviço';end if;
 manager:=a->>'role'<>'mechanic';
 if d.signature_verified_at is null or d.signature_verified_at<now()-interval '1 minute' then raise exception 'Confirme sua assinatura';end if;
 if p_action not in('assign','exclude','execute','tc') or p_action is null then raise exception 'Operação inválida';end if;
 if p_action in('assign','exclude') and not manager then raise exception 'Somente liderança pode designar ou excluir do planejamento';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Selecione de 1 a 100 registros';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Seleção duplicada';end if;
 if p_action='assign' and coalesce(cardinality(p_assigned),0)=0 then raise exception 'Selecione os executantes';end if;
 if p_action='execute' and nullif(trim(p_text),'') is null then raise exception 'Descreva o que foi executado nos registros selecionados';end if;
 if length(p_text)>12000 or (p_action='tc' and length(p_text)>160) then raise exception 'Texto acima do limite';end if;
 for selection in select value from jsonb_array_elements(p_items) order by value->>'id' loop
  select * into r from public.maintenance_records where id=(selection->>'id')::uuid for update;
  if r.id is null then raise exception 'Registro não encontrado';end if;
  if r.revision is distinct from (selection->>'revision')::bigint then raise exception 'Um registro foi atualizado. Recarregue a seleção';end if;
  if a->>'role' not in('admin','app_manager','maintenance_director','maintenance_manager') and r.base<>coalesce(a->>'base','') then raise exception 'Registro fora da sua base';end if;
  if p_action='assign' and exists(select 1 from unnest(p_assigned) emp where not exists(select 1 from public.authorized_users u where u.employee_number=emp and u.active and u.assigned_base=r.base and coalesce(u.job_role,u.access_profile) in('mechanic','maintenance_assistant','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector'))) then raise exception 'Selecione executantes ativos da base de cada tarefa';end if;
  if p_action='tc' and upper(trim(p_text)) in('NA','N/A') and r.technical_case->>'report'='discrepancy' then raise exception 'Informe a TC da pane; N/A se aplica a registros sem TC aplicável';end if;
  entry:=jsonb_build_object('id',gen_random_uuid(),'employeeNumber',a->>'employee','at',stamp,'kind',case p_action when 'assign' then 'assignment' when 'execute' then 'action' else 'status' end,'description',case p_action when 'assign' then 'Designado para '||array_to_string(p_assigned,', ') when 'exclude' then 'Excluído do planejamento' when 'execute' then trim(p_text) else 'TC atualizada: '||coalesce(nullif(trim(p_text),''),'não informada') end);
  next_data:=r.data;
  if p_action='assign' then entry:=entry||jsonb_build_object('assignedTo',to_jsonb(p_assigned));next_data:=next_data||jsonb_build_object('assignedTo',to_jsonb(p_assigned));end if;
  if p_action='execute' then entry:=entry||'{"result":"satisfactory"}';next_data:=next_data||'{"planningState":"completed"}';end if;
  if p_action='exclude' then next_data:=next_data||'{"planningState":"excluded"}';end if;
  if p_action='tc' then next_data:=next_data||jsonb_build_object('tc',trim(p_text));end if;
  next_data:=next_data||jsonb_build_object('entries',coalesce(next_data->'entries','[]')||jsonb_build_array(entry),'updatedAt',stamp);
  update public.maintenance_records set data=next_data,tc=case when p_action='tc' then nullif(trim(p_text),'') else tc end,revision=revision+1,updated_at=stamp where id=r.id;
  count_changed:=count_changed+1;
 end loop;
 return count_changed;
end $$;
revoke all on function public.service_planning_batch(jsonb,text,text[],text) from public,anon;
grant execute on function public.service_planning_batch(jsonb,text,text[],text) to authenticated;
