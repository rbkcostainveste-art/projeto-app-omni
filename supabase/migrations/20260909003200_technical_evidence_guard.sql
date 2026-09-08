begin;
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'valid_aprs:=nullif(c->>''aprsRef'','''')', $patch$
 -- New unsafe evidence must be accepted, while any incompatible release is withdrawn.
 if changed and coalesce((c->>'critical')::boolean,false) then c:=c||'{"aircraft":"unavailable"}';end if;
 if tg_op='UPDATE' and exists(select 1 from jsonb_array_elements(coalesce(new.data->'entries','[]')) e where e->>'kind'='action' and e->>'result'='nonconforming' and not coalesce(old.data->'entries','[]') @> jsonb_build_array(e)) then
  c:=c||'{"investigation":"test_failed","aircraft":"unavailable"}';
 end if;
 valid_aprs:=nullif(c->>'aprsRef','')
 $patch$);
 execute f;
 select pg_get_functiondef('public.technical_case_action(text,uuid,jsonb)'::regprocedure) into f;
 f:=replace(f,'c:=p_payload->''data'';', 'if nullif(trim(p_payload->>''reason''),'''') is null then raise exception ''Informe a referência e o motivo da autorização'';end if; c:=p_payload->''data'';');
 execute f;
 -- Preserve all current Cockpit behavior, adding canonical technical states to the existing summary.
 select pg_get_functiondef('public.cockpit(text,jsonb)'::regprocedure) into f;
 if strpos(f,'''priority'',r.priority')=0 then raise exception 'Cockpit summary signature changed; review migration';end if;
 f:=replace(f,'''priority'',r.priority','''priority'',r.priority,''technicalCase'',r.technical_case');
 execute f;
end $$;
commit;
