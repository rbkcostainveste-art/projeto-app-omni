-- Return a normal end state to the remaining caller after the other side hangs up.
do $$ declare definition text;begin
 select pg_get_functiondef('public.chat_call(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'elsif p_action in(''poll'',''signal'',''leave'') then',
 'elsif p_action in(''poll'',''signal'',''leave'') then
  if callrow.ended_at is not null then return jsonb_build_object(''ended'',true);end if;');
 execute definition;
end $$;
create index chat_calls_conversation_history on public.chat_calls(conversation_id,created_at desc);
create index chat_call_members_live on public.chat_call_members(heartbeat) where state='joined';
