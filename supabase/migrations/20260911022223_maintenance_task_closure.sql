-- A successful execution is separate from the inspector's audited closure.
create or replace function public.close_maintenance_task(p_post_id text,p_action_id text,p_expected_revision bigint,p_reason text,p_closure jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor jsonb:=private.technical_actor(); p public.operational_wall_posts; r public.maintenance_records; a jsonb; actions jsonb; c jsonb; stamp timestamptz:=clock_timestamp(); rid uuid; result jsonb;
begin
 if actor is null or not (coalesce((actor->>'admin')::boolean,false) or actor->>'role' in('maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager')) then raise exception 'Somente inspetor ou superior encerra ações';end if;
 if not exists(select 1 from public.device_identities where auth_user_id=auth.uid() and signature_verified_at>now()-interval '1 minute') then raise exception 'Confirme sua senha para assinar o encerramento';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Informe a conclusão do responsável';end if;
 select nullif(data->>'maintenanceRecordId','')::uuid into rid from public.operational_wall_posts where id=p_post_id;
 if rid is not null then
  select * into r from public.maintenance_records where id=rid;
  perform pg_advisory_xact_lock(hashtextextended(r.prefix,83642));
  select * into r from public.maintenance_records where id=rid for update;
  if not coalesce(private.technical_access(r),false) then raise exception 'Relato fora da sua base';end if;
 end if;
 select * into p from public.operational_wall_posts where id=p_post_id for update;
 if p.id is null or (not coalesce((actor->>'admin')::boolean,false) and actor->>'role' not in('maintenance_manager','maintenance_director') and p.base is distinct from actor->>'base') then raise exception 'Ação fora da sua base';end if;
 if p.revision<>p_expected_revision then raise exception 'Ação atualizada em outro aparelho. Reabra antes de encerrar';end if;
 select value into a from jsonb_array_elements(coalesce(p.data->'actions','[]')) where value->>'id'=p_action_id;
 if a is null or a->>'status'='resolved' then raise exception 'Ação inexistente ou já encerrada';end if;
 select value into result from jsonb_array_elements(coalesce(a->'executions','[]')) order by (value->>'at')::timestamptz desc limit 1;
 if a->>'status'<>'satisfactory' or result->>'result' is distinct from 'satisfactory' then raise exception 'Registre resultado satisfatório antes de encerrar';end if;
 if p_closure is not null then
  if r.id is null or r.revision<>coalesce((p_closure->>'revision')::bigint,-1) then raise exception 'Relato atualizado. Reabra antes de confirmar';end if;
  if not coalesce((p_closure->>'confirmed')::boolean,false) then raise exception 'Confirme o encerramento do relato e a disponibilidade';end if;
  if exists(select 1 from public.operational_wall_posts w cross join lateral jsonb_array_elements(coalesce(w.data->'actions','[]')) x where w.data->>'maintenanceRecordId'=r.id::text and not(w.id=p_post_id and x->>'id'=p_action_id) and x->>'status' is distinct from 'resolved') then raise exception 'Existem outras ações deste relato ainda não encerradas';end if;
  c:=r.technical_case||jsonb_build_object('investigation','closed','aircraft','released','reason',trim(p_reason));
  if nullif(trim(p_closure->>'aprsRef'),'') is not null then c:=c||jsonb_build_object('aprsRef',trim(p_closure->>'aprsRef'),'confirmAprs',true);end if;
  if nullif(trim(p_closure->>'officialId'),'') is not null then c:=c||jsonb_build_object('official','linked','officialId',trim(p_closure->>'officialId'));end if;
  if coalesce((p_closure->>'officialClosed')::boolean,false) then c:=c||jsonb_build_object('officialClosed',true);end if;
  -- Existing technical guards enforce APRS, eDB, critical evidence and other cases.
  perform public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));
  select * into p from public.operational_wall_posts where id=p_post_id;
 end if;
 a:=a||jsonb_build_object('status','resolved','closedBy',actor->>'employee','closedAt',stamp,'closureReason',trim(p_reason));
 select jsonb_agg(case when x->>'id'=p_action_id then a else x end order by ord) into actions from jsonb_array_elements(p.data->'actions') with ordinality as entries(x,ord);
 update public.operational_wall_posts set resolved=not exists(select 1 from jsonb_array_elements(actions)x where x->>'status'<>'resolved'),
 data=p.data||jsonb_build_object('actions',actions,'resolved',not exists(select 1 from jsonb_array_elements(actions)x where x->>'status'<>'resolved'),'history',coalesce(p.data->'history','[]')||jsonb_build_array(jsonb_build_object('event','Encerrou ação','employeeNumber',actor->>'employee','at',stamp,'reason',trim(p_reason)))),revision=revision+1,updated_at=stamp where id=p_post_id returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.close_maintenance_task(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.close_maintenance_task(text,text,bigint,text,jsonb) to authenticated;

-- Content changes, not reads or receipts, move the source report up the timeline.
create or replace function private.publish_technical_priority_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor jsonb:=private.technical_actor(); event_name text;
begin
 if private.technical_axes(new.technical_case) is distinct from private.technical_axes(old.technical_case) or new.technical_case->>'priority' is distinct from old.technical_case->>'priority' or new.title is distinct from old.title or new.data->>'description' is distinct from old.data->>'description' then
  event_name:=case when new.technical_case->>'investigation'='closed' and old.technical_case->>'investigation' is distinct from 'closed' then 'Encerrou relato técnico' when old.technical_case->>'investigation'='closed' and new.technical_case->>'investigation'<>'closed' then 'Reabriu relato técnico' else 'Atualizou relato técnico' end;
  update public.operational_wall_posts w set data=jsonb_set(w.data,'{history}',coalesce(w.data->'history','[]')||jsonb_build_array(jsonb_build_object('employeeNumber',actor->>'employee','at',clock_timestamp(),'event',event_name))),revision=w.revision+1,updated_at=clock_timestamp()
  where w.data->>'maintenanceRecordId'=new.id::text and jsonb_array_length(coalesce(w.data->'actions','[]'))=0;
 end if;
 return new;
end $$;
-- The generic wall endpoint cannot bypass inspector review.
create or replace function private.guard_wall_action_closure() returns trigger language plpgsql security definer set search_path='' as $$
declare actor jsonb:=private.technical_actor(); item jsonb; prior jsonb; result jsonb; actions jsonb:='[]';
begin
 for item in select value from jsonb_array_elements(coalesce(new.data->'actions','[]')) loop
  select value into prior from jsonb_array_elements(coalesce(old.data->'actions','[]')) where value->>'id'=item->>'id';
  if item->>'status'='resolved' and prior->>'status' is distinct from 'resolved' then
   if actor is null or not(coalesce((actor->>'admin')::boolean,false) or actor->>'role' in('maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager')) then raise exception 'Somente inspetor ou superior encerra ações';end if;
   select value into result from jsonb_array_elements(coalesce(prior->'executions','[]')) order by (value->>'at')::timestamptz desc limit 1;
   if prior->>'status'<>'satisfactory' or result->>'result' is distinct from 'satisfactory' then raise exception 'Ação sem resultado satisfatório para encerrar';end if;
   if nullif(trim(item->>'closureReason'),'') is null or not exists(select 1 from public.device_identities where auth_user_id=auth.uid() and signature_verified_at>now()-interval '1 minute') then raise exception 'Use Encerrar ação e confirme sua assinatura';end if;
   item:=item||jsonb_build_object('closedBy',actor->>'employee','closedAt',clock_timestamp());
  elsif prior->>'status'='resolved' and item->>'status'='resolved' then
   item:=item||jsonb_build_object('closedBy',prior->'closedBy','closedAt',prior->'closedAt','closureReason',prior->'closureReason');
  end if;
  actions:=actions||jsonb_build_array(item);
 end loop;
 new.data:=jsonb_set(new.data,'{actions}',actions);return new;
end $$;
revoke all on function private.guard_wall_action_closure() from public,anon,authenticated;
create trigger wall_action_closure_guard before update on public.operational_wall_posts for each row execute function private.guard_wall_action_closure();

-- Maintenance leaders have the same technical review capabilities as inspectors.
do $$ declare definition text; begin
 select pg_get_functiondef('private.technical_allowed(text)'::regprocedure) into definition;
 definition:=replace(definition,'''maintenance_inspector'',''maintenance_coordinator''','''maintenance_inspector'',''maintenance_leader'',''maintenance_coordinator''');
 execute definition;
end $$;
