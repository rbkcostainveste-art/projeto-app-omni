do $$ declare definition text;begin
select pg_get_functiondef('public.record_flight_operation(text,uuid,integer,text,jsonb)'::regprocedure) into definition;
definition:=replace(definition,'typ:=p_payload->>''type'';',E'typ:=p_payload->>''type'';\n if f->>''maintenancePostId'' is not null and jsonb_array_length(rec.events)=0 and (rec.checks#>>''{fuel,approval,result}'' is distinct from ''ok'' or rec.checks#>>''{inspection,approval,result}'' is distinct from ''ok'') then raise exception ''Confirme pré-voo e abastecimento antes de iniciar'';end if;');execute definition;
end $$;
