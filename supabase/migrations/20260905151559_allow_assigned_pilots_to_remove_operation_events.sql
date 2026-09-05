do $$
declare definition text;
begin
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$if p_action in ('event','correct') then$old$,$new$if p_action in ('event','correct','delete_event') then$new$);
 definition:=replace(definition,$old$  else
   select ordinality::integer-1,value into idx,ev from jsonb_array_elements(rec.events) with ordinality where value->>'id'=p_payload->>'id';$old$,
 $new$  elsif p_action='delete_event' then
   select ordinality::integer-1,value into idx,ev from jsonb_array_elements(rec.events) with ordinality where value->>'id'=p_payload->>'id';
   if ev is null then raise exception 'Evento não encontrado'; end if;
   p_payload:=p_payload||jsonb_build_object('removedEvent',ev);
   rec.events:=rec.events-idx;
   begin
    perform private.validate_operation_events(rec.events,f->>'model');
   exception when others then
    raise exception 'Há eventos posteriores que dependem deste registro. Exclua primeiro os eventos dependentes, do mais recente para o mais antigo.';
   end;
   patch:=jsonb_build_object('engineStart','pending','actualEngineStart',null,'shutdown','pending','actualShutdown',null,'completedAt',null,'operationEndedAt',null);
  else
   select ordinality::integer-1,value into idx,ev from jsonb_array_elements(rec.events) with ordinality where value->>'id'=p_payload->>'id';$new$);
 if position('removedEvent' in definition)=0 then raise exception 'Não foi possível atualizar a função de eventos'; end if;
 execute definition;
end $$;
notify pgrst,'reload schema';
