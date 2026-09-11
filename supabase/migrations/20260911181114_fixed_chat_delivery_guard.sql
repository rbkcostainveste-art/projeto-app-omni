create function public.chat_push_allowed(p_message bigint,p_employee text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_messages msg where msg.id=p_message and private.chat_current(msg.conversation_id,p_employee) and private.chat_message_visible(msg.conversation_id,msg.id,p_employee));
$$;
revoke all on function public.chat_push_allowed(bigint,text) from public,anon,authenticated;
grant execute on function public.chat_push_allowed(bigint,text) to service_role;
