do $$ declare definition text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'''base'',assigned_base)','''base'',assigned_base,''fleets'',coalesce(fleets,''{}''::text[]),''mission'',mission,''workShift'',work_shift)');
 definition:=replace(definition,'if cardinality(ids)>50 then raise exception ''Limite de 50 participantes'';end if;','');
 definition:=replace(definition,'if (select count(*) from public.internal_conversation_members where conversation_id=cid)+cardinality(ids)>50 then raise exception ''Limite de 50 participantes'';end if;','');
 execute definition;
end $$;
