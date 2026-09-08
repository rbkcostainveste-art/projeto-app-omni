-- Fix the record-variable/table-alias collision and provide inbox previews.
do $migration$ declare definition text; first_part text; last_part text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 first_part:=split_part(definition,' elsif p_action=''list'' then',1);
 last_part:=split_part(definition,' elsif p_action=''create'' then',2);
 if first_part=definition or last_part='' then raise exception 'Chat definition changed';end if;
 definition:=first_part||$body$
 elsif p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(inbox) order by inbox.updated_at desc),'[]') from (
   select conv.*,
    (select count(*) from public.internal_messages msg where msg.conversation_id=conv.id and msg.id>membership.last_read_id and msg.sender<>actor) unread,
    (select count(*) from public.internal_messages msg where msg.conversation_id=conv.id and msg.kind='message') message_count,
    (select coalesce(nullif(msg.body,''),'📎 Anexo') from public.internal_messages msg where msg.conversation_id=conv.id order by msg.id desc limit 1) last_message,
    (select jsonb_agg(jsonb_build_object('id',member.employee_number,'name',coalesce(person.display_name,member.employee_number)) order by member.joined_at,member.employee_number) from public.internal_conversation_members member left join public.authorized_users person using(employee_number) where member.conversation_id=conv.id) members,
    (select string_agg(coalesce(person.display_name,member.employee_number),', ' order by member.joined_at) from public.internal_conversation_members member left join public.authorized_users person using(employee_number) where member.conversation_id=conv.id) participants
   from public.internal_conversations conv join public.internal_conversation_members membership on membership.conversation_id=conv.id and membership.employee_number=actor
  ) inbox);
 elsif p_action='create' then$body$||last_part;
 execute definition;
end $migration$;
