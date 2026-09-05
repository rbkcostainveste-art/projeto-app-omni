create policy "operation records only through authorized RPCs" on public.flight_operation_records for all to authenticated using(false) with check(false);
do $$
declare definition text;
begin
 select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'-- Serializes first-operation selection, requests and shared-state changes together.',
 $new$if p_request_id is null or p_revision is null or p_revision<0 or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Solicitação inválida'; end if;
 -- Serializes first-operation selection, requests and shared-state changes together.$new$);
 definition:=replace(definition,$old$kind:=case when key='inspection'$old$,
 $new$if key='inspection' and not (ctx->>'first')::boolean and not exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) x where s.id='main' and x->>'id'=target and (x->>'shutdown'='ok' or nullif(x->>'actualShutdown','') is not null)) then raise exception 'Aguarde o encerramento da operação anterior para assinar entre voos'; end if;
  kind:=case when key='inspection'$new$);
 execute definition;
end $$;
notify pgrst,'reload schema';
