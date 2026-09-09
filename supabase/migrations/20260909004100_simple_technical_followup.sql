begin;
-- Additive: existing official/APRS guards remain in force.
do $$ declare f text; begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'''aprs'',''monitoring'',''recurrence'',''closed'') then raise exception ''Eixos técnicos inválidos''','''aprs'',''monitoring'',''condition_watch'',''recurrence'',''closed'') then raise exception ''Eixos técnicos inválidos''');
 execute f;
 select pg_get_functiondef('public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text)'::regprocedure) into f;
 f:=replace(f,'''maintenance_leader'',''maintenance_inspector'') then','''maintenance_leader'',''maintenance_inspector'',''mechanic'') then');
 f:=replace(f,'Somente inspetores e liderança podem gerar ações','Somente mecânicos, inspetores e liderança podem gerar ações');
 execute f;
end $$;

create function private.guard_technical_followup() returns trigger
language plpgsql security definer set search_path='' as $$
declare c jsonb:=new.technical_case; o jsonb:='{}'; a jsonb:=private.technical_actor(); w jsonb;
begin
 if tg_op='UPDATE' then o:=old.technical_case;end if;
 c:=c||jsonb_build_object('priority',coalesce(c->>'priority',case when new.priority='urgent' then 'urgent' else 'routine' end));
 if c->>'priority' not in('routine','urgent') then raise exception 'Prioridade inválida';end if;
 if tg_op='UPDATE' and c->>'priority' is distinct from coalesce(o->>'priority',case when old.priority='urgent' then 'urgent' else 'routine' end) and nullif(trim(c->>'reason'),'') is null then raise exception 'Alteração de prioridade exige motivo';end if;
 if coalesce((c->>'critical')::boolean,false) then c:=c||'{"priority":"urgent"}';end if;
 -- Fresh adverse evidence is always saved, and ends incompatible monitoring.
 if c->>'investigation'='condition_watch' and (coalesce((c->>'critical')::boolean,false) or c->>'lastAdverseAt' is distinct from o->>'lastAdverseAt') then c:=c||'{"investigation":"triage"}';end if;
 w:=coalesce(c->'conditionWatch','{}');
 if c->>'investigation'='condition_watch' then
  if c->>'report' in('discrepancy','recurrence') then raise exception 'Uma discrepância ativa não pode ser classificada como condição dentro dos limites';end if;
  if nullif(trim(w->>'reference'),'') is null or nullif(trim(w->>'measurement'),'') is null or nullif(trim(w->>'limit'),'') is null or nullif(trim(w->>'nextInspection'),'') is null then raise exception 'Informe referência/revisão, condição medida, limite aplicável e próxima inspeção';end if;
  if o->>'investigation' is distinct from 'condition_watch' or w is distinct from coalesce(o->'conditionWatch','{}') or coalesce((c->>'confirmCondition')::boolean,false) then
   if not private.technical_allowed('classify') or nullif(trim(c->>'reason'),'') is null then raise exception 'Confirmar condição dentro dos limites exige avaliação do responsável autorizado e motivo';end if;
   c:=c||jsonb_build_object('conditionBy',a->>'employee','conditionName',a->>'name','conditionAt',clock_timestamp());
  else c:=c||jsonb_build_object('conditionBy',o->>'conditionBy','conditionName',o->>'conditionName','conditionAt',o->>'conditionAt');end if;
 else c:=c||jsonb_build_object('conditionBy',o->>'conditionBy','conditionName',o->>'conditionName','conditionAt',o->>'conditionAt');end if;
 new.technical_case:=c-'confirmCondition';return new;
end $$;
revoke all on function private.guard_technical_followup() from public,anon,authenticated;
create trigger zz_guard_technical_followup before insert or update on public.maintenance_records for each row execute function private.guard_technical_followup();

create or replace function private.technical_axes(c jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('report',c->>'report','official',c->>'official','aircraft',c->>'aircraft','investigation',c->>'investigation','priority',coalesce(c->>'priority','routine'),'critical',coalesce((c->>'critical')::boolean,false),'aprsRef',c->>'aprsRef','aprsBy',c->>'aprsBy')
$$;
do $$ declare f text; begin
 select pg_get_functiondef('private.guard_wall_technical_axes()'::regprocedure) into f;
 f:=replace(f,'''technicalCase'',private.technical_axes(r.technical_case)', '''technicalCase'',private.technical_axes(r.technical_case)||jsonb_build_object(''priority'',coalesce(r.technical_case->>''priority'',case when r.priority=''urgent'' then ''urgent'' else ''routine'' end)),''priority'',case when coalesce((r.technical_case->>''critical'')::boolean,false) then ''urgent'' else coalesce(r.technical_case->>''priority'',case when r.priority=''urgent'' then ''urgent'' else ''routine'' end) end');
 execute f;
 select pg_get_functiondef('public.publish_maintenance_record_to_wall()'::regprocedure) into f;
 f:=replace(f,'if not (new.record_type=''fault'' or new.record_type=''discrepancy'' and new.priority=''urgent'') then return new; end if;', 'if new.record_type=''inspection'' then return new;end if; if exists(select 1 from public.operational_wall_posts w where w.data->>''maintenanceRecordId''=new.id::text and jsonb_array_length(coalesce(w.data->''actions'',''[]''))=0) then return new;end if;');
 execute f;
end $$;
-- Ensure changing a routine case to urgent also supplies a timeline record.
create trigger technical_wall_on_case_update after update of technical_case on public.maintenance_records for each row execute function public.publish_maintenance_record_to_wall();
commit;
