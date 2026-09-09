begin;
-- Supabase CLI unavailable in workspace; apply and track with the connected MCP.
do $$ declare f text; anchor text; begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 anchor:=' valid_aprs:=nullif(c->>''aprsRef''';
 if strpos(f,anchor)=0 then raise exception 'Technical guard anchor missing';end if;
 f:=replace(f,anchor,$patch$
 -- Accept new adverse evidence before validating the former release stage.
 if c->>'lastAdverseAt' is distinct from o->>'lastAdverseAt' and c->>'investigation' in('aprs','monitoring','condition_watch','closed') then
  c:=c||'{"investigation":"triage","aircraft":"unavailable"}';new.status:='open';
 end if;
 if c->'action' is distinct from o->'action' and c#>>'{action,outcome}'='nonconforming' then
  c:=c||jsonb_build_object('investigation','test_failed','aircraft','unavailable','officialClosed',false,'lastAdverseAt',clock_timestamp());new.status:='open';
 end if;
 -- Expiration must not prevent recording a new observation.
 if c->>'aircraft'='deferred' and nullif(d->>'deadline','')::timestamptz<=clock_timestamp() then
  c:=c||'{"aircraft":"evaluation","investigation":"triage"}';
 end if;
 valid_aprs:=nullif(c->>'aprsRef'$patch$);
 f:=replace(f,'and new.status is distinct from old.status and c->>''investigation''<>''closed'' then', 'and new.status is distinct from old.status and c->>''investigation''<>''closed'' and c->>''lastAdverseAt'' is not distinct from o->>''lastAdverseAt'' then');
 execute f;
end $$;

-- Operational designation explicitly requested by the operator. Administrator access
-- alone does not confer these capabilities; additional named permissions remain available.
create or replace function private.technical_allowed(capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select capability=any(array['classify','not_applicable','defer','aprs','release','close','critical']) and (
 coalesce(c.data->'permissions'->capability ? (a->>'employee'),false)
 or a->>'role' in('maintenance_inspector','maintenance_coordinator','maintenance_manager','maintenance_director')
 or (a->>'role'='mechanic' and coalesce(c.data->'aprsMechanics' ? (a->>'employee'),false)))
 from private.technical_operator_config c cross join (select private.technical_actor() a)s where c.id and a is not null
$$;

create function private.technical_recipients() returns table(employee text)
language sql stable security definer set search_path='' as $$
 select u.employee_number from public.authorized_users u cross join private.technical_operator_config c
 where c.id and u.active and (u.job_role in('maintenance_inspector','maintenance_coordinator','maintenance_manager','maintenance_director')
 or (u.job_role='mechanic' and coalesce(c.data->'aprsMechanics' ? u.employee_number,false))
 or coalesce(c.data->'recipients' ? u.employee_number,false))
$$;
revoke all on function private.technical_recipients() from public,anon,authenticated;

do $$ declare f text; begin
 select pg_get_functiondef('public.technical_case_action(text,uuid,jsonb)'::regprocedure) into f;
 f:=replace(f,'c:=p_payload->''data'';', $patch$c:=p_payload->'data';
  if jsonb_typeof(coalesce(c->'aprsMechanics','[]'))<>'array' then raise exception 'Designações APRS inválidas';end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(c->'aprsMechanics','[]')) e where not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active and u.job_role='mechanic')) then raise exception 'A designação APRS exige matrícula de mecânico ativo';end if;
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Informe motivo e referência da designação do operador';end if;
 $patch$);
 -- Do not disclose named mechanic designations through non-admin configuration views.
 f:=replace(f,$old$cfg.data-'permissions'-'recipients'$old$, $new$cfg.data-'permissions'-'recipients'-'aprsMechanics'$new$);
 execute f;
 select pg_get_functiondef('private.audit_technical_case()'::regprocedure) into f;
 f:=replace(f,$old$from private.technical_operator_config c cross join lateral jsonb_array_elements_text(c.data->'recipients')e$old$,'from private.technical_recipients() e');
 f:=replace(f,$old$select new.id,e,'critical'$old$,$new$select new.id,e.employee,'critical'$new$);
 execute f;
end $$;

create function private.technical_service_eligible(c jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(c->>'priority'='urgent' or (c->>'critical')::boolean or c->>'report' in('discrepancy','recurrence') or c->>'official'='pending' or c->>'investigation' in('monitoring','condition_watch') or c->>'aircraft' in('unavailable','maintenance'),false)
$$;
create function private.guard_technical_tracking() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb:=new.technical_case; o jsonb:='{}'; w jsonb; a jsonb:=private.technical_actor();
begin
 if tg_op='UPDATE' then o:=old.technical_case;end if;
 c:=c-'serviceEnteredAt';
 if o ? 'serviceEnteredAt' then c:=c||jsonb_build_object('serviceEnteredAt',o->'serviceEnteredAt');
 elsif new.record_type<>'inspection' and (private.technical_service_eligible(c) or private.technical_service_eligible(o)) then
 c:=c||jsonb_build_object('serviceEnteredAt',clock_timestamp());end if;
 -- Capture entry provenance separately from human verification in the official system.
 if c->>'officialId' is distinct from o->>'officialId' then
 c:=c||jsonb_build_object('officialReferenceBy',a->>'employee','officialReferenceAt',clock_timestamp(),'officialVerifiedBy',null,'officialVerifiedAt',null);
 else c:=c||jsonb_build_object('officialReferenceBy',o->'officialReferenceBy','officialReferenceAt',o->'officialReferenceAt','officialVerifiedBy',o->'officialVerifiedBy','officialVerifiedAt',o->'officialVerifiedAt');end if;
 if coalesce((c->>'confirmOfficial')::boolean,false) then
 if not private.technical_allowed('classify') or nullif(trim(c->>'officialId'),'') is null or nullif(trim(c->>'reason'),'') is null then raise exception 'Conferência humana exige responsável autorizado, referência e motivo';end if;
 c:=c||jsonb_build_object('officialVerifiedBy',a->>'employee','officialVerifiedAt',clock_timestamp());end if;
 w:=coalesce(c->'conditionWatch','{}');
 if nullif(w->>'dueKind','') is not null then
 if w->>'dueKind' not in('date','hours','cycles') then raise exception 'Tipo de prazo inválido';end if;
 if w->>'dueKind'='date' then
 if nullif(w->>'dueAt','') is null then raise exception 'Informe a data de acompanhamento';end if;
 perform (w->>'dueAt')::timestamptz;
 else
 if coalesce(w->>'dueValue','') !~ '^\d+(\.\d+)?$' or coalesce(w->>'currentValue','') !~ '^\d+(\.\d+)?$' or nullif(trim(w->>'counterSource'),'') is null then raise exception 'Informe limite, leitura atual e origem do contador';end if;
 end if;
 end if;
 if w is distinct from coalesce(o->'conditionWatch','{}') then c:=c||jsonb_build_object('watchUpdatedBy',a->>'employee','watchUpdatedAt',clock_timestamp());
 else c:=c||jsonb_build_object('watchUpdatedBy',o->'watchUpdatedBy','watchUpdatedAt',o->'watchUpdatedAt');end if;
 new.technical_case:=c-'confirmOfficial';return new;
end $$;
revoke all on function private.technical_service_eligible(jsonb),private.guard_technical_tracking() from public,anon,authenticated;
create trigger zzz_guard_technical_tracking before insert or update on public.maintenance_records for each row execute function private.guard_technical_tracking();

create or replace function private.technical_deadline_alerts() returns void language sql security definer set search_path='' as $$
 insert into public.technical_case_alerts(record_id,employee_number,kind,message)
 select r.id,e.employee,'deadline:'||(r.technical_case#>>'{disposition,deadline}'),'Prazo de disposição: '||r.prefix||' · '||r.title||' · '||(r.technical_case#>>'{disposition,deadline}')
 from public.maintenance_records r cross join private.technical_recipients() e
 where r.technical_case->>'aircraft'='deferred' and nullif(r.technical_case#>>'{disposition,deadline}','')::timestamptz<=now()+interval '24 hours'
 on conflict do nothing;
 insert into public.technical_case_alerts(record_id,employee_number,kind,message)
 select r.id,e.employee,'watch:'||md5((r.technical_case->'conditionWatch')::text),'Reavaliar acompanhamento: '||r.prefix||' · '||r.title
 from public.maintenance_records r cross join private.technical_recipients() e
 where r.technical_case->>'investigation' in('condition_watch','monitoring') and (
 case when r.technical_case#>>'{conditionWatch,dueKind}'='date' then nullif(r.technical_case#>>'{conditionWatch,dueAt}','')::timestamptz<=now()+interval '24 hours'
 when r.technical_case#>>'{conditionWatch,dueKind}' in('hours','cycles') then (r.technical_case#>>'{conditionWatch,currentValue}')::numeric >= (r.technical_case#>>'{conditionWatch,dueValue}')::numeric else false end)
 on conflict do nothing
$$;

-- Wall receives only display state, never the internal detailed maintenance narrative.
create or replace function private.technical_axes(c jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('report',c->>'report','official',c->>'official','aircraft',c->>'aircraft','investigation',c->>'investigation','priority',coalesce(c->>'priority','routine'),'critical',coalesce((c->>'critical')::boolean,false),'disposition',jsonb_build_object('deadline',c#>>'{disposition,deadline}'),'conditionWatch',jsonb_build_object('dueKind',c#>>'{conditionWatch,dueKind}','dueAt',c#>>'{conditionWatch,dueAt}','dueValue',c#>>'{conditionWatch,dueValue}','currentValue',c#>>'{conditionWatch,currentValue}'))
$$;
commit;
