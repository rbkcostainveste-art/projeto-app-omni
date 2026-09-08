-- Chat membership is independent of operational role/base permissions.
do $$ declare definition text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition, ' or (pid is not null and not private.chat_activity_access(pid,target))', '');
 definition:=replace(definition, ' or (c.post_id is not null and not private.chat_activity_access(c.post_id,target))', '');
 definition:=replace(definition, 'Participante sem acesso à atividade ou inativo', 'Participante inativo ou não encontrado');
 definition:=replace(definition, 'if not private.chat_activity_access(c.post_id,actor) then raise exception ''Atividade fora do seu acesso'';end if;', '');
 -- Add assignment alerts only for participants eligible for that activity.
 definition:=replace(definition, 'string_to_array(coalesce(a->>''assignedTo'',''''),'','')||fresh', 'string_to_array(coalesce(a->>''assignedTo'',''''),'','')||array(select person from unnest(fresh) person where private.chat_activity_access(c.post_id,person))');
 definition:=replace(definition, 'Incluiu participantes na conversa e nos avisos da atividade: ', 'Incluiu participantes na conversa (avisos conforme acesso à atividade): ');
 execute definition;
end $$;
