do $$ declare definition text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'jsonb_array_elements(p.data->''actions'') a cross join lateral regexp_split_to_table(coalesce(a->>''assignedTo''','jsonb_array_elements(p.data->''actions'') activity cross join lateral regexp_split_to_table(coalesce(activity->>''assignedTo''');
 execute definition;
end $$;
