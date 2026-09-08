do $$
declare definition text;
begin
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$if p_action in ('event','correct','delete_event') then$old$,$new$if p_action='reopen' then
  if not (d.is_admin or role_name in ('admin','app_manager')) then raise exception 'Somente administrador pode reabrir a operação';end if;
  if nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'Informe o motivo da reabertura';end if;
  if not (f->>'shutdown'='ok' or nullif(f->>'actualShutdown','') is not null) then raise exception 'Operação já está aberta';end if;
  if rec.events->-1->>'type'='finish' then
   p_payload:=p_payload||jsonb_build_object('removedFinish',rec.events->-1);
   rec.events:=rec.events-(jsonb_array_length(rec.events)-1);
  end if;
  patch:=jsonb_build_object('shutdown','pending','actualShutdown',null,'completedAt',null,'operationEndedAt',null);
 elsif p_action in ('event','correct','delete_event') then$new$);
 if position('removedFinish' in definition)=0 then raise exception 'Reopen operation patch not applied';end if;
 execute definition;
end $$;
