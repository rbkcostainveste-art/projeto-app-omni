-- Run against the migrated schema. All synthetic conversations/messages are rolled back.
begin;
do $$
declare owner_id uuid; owner_employee text; other_id uuid; other_employee text;
 auto_id uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid(); result jsonb;
begin
 select d.auth_user_id,d.employee_number into owner_id,owner_employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active limit 1;
 select d.auth_user_id,d.employee_number into other_id,other_employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.employee_number<>owner_employee limit 1;
 if owner_id is null or other_id is null then raise exception 'Two active identities required for isolation test';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.personal_assistant('create_conversation',jsonb_build_object('employee',owner_employee,'id',a,'title','Synthetic A'));
 perform public.personal_assistant('create_conversation',jsonb_build_object('employee',owner_employee,'id',a,'title','Retry A'));
 perform public.personal_assistant('create_conversation',jsonb_build_object('employee',owner_employee,'id',b,'title','Synthetic B','contextKind','maintenance-draft','contextId','synthetic-draft','contextLabel','Rascunho de teste'));
 if (select count(*) from public.personal_assistant_conversations where id=a)<>1 then raise exception 'Creation retry duplicated conversation';end if;
 perform public.personal_assistant('append',jsonb_build_object('employee',owner_employee,'conversationId',a,'requestId',request_id,'message','Synthetic A only','reply','Reply A only'));
 perform public.personal_assistant('append',jsonb_build_object('employee',owner_employee,'conversationId',a,'requestId',request_id,'message','Synthetic A only','reply','Reply A only'));
 result:=public.personal_assistant('list',jsonb_build_object('employee',owner_employee,'conversationId',a));
 if jsonb_array_length(result)<>1 then raise exception 'Append retry duplicated message';end if;
 result:=public.personal_assistant('list',jsonb_build_object('employee',owner_employee,'conversationId',b));
 if result<>'[]'::jsonb then raise exception 'History mixed between conversations';end if;
 begin
  perform public.personal_assistant('append',jsonb_build_object('employee',owner_employee,'conversationId',b,'requestId',request_id,'message','Synthetic wrong conversation','reply','Wrong'));
  raise exception 'Cross-conversation request accepted';
 exception when others then if sqlerrm<>'Resposta pertence a outra conversa' then raise;end if;end;
 perform public.personal_assistant('create_conversation',jsonb_build_object('employee',owner_employee,'id',auto_id,'title','Nova conversa','autoTitle',true));
 perform public.personal_assistant('append',jsonb_build_object('employee',owner_employee,'conversationId',auto_id,'requestId',gen_random_uuid(),'message',E'  Relato  do\nCHT  ','reply','Resposta de teste'));
 if (select title from public.personal_assistant_conversations where id=auto_id)<>'Relato do CHT' then raise exception 'Automatic title missing';end if;
 perform public.personal_assistant('rename_conversation',jsonb_build_object('employee',owner_employee,'conversationId',auto_id,'title','Título escolhido'));
 perform public.personal_assistant('append',jsonb_build_object('employee',owner_employee,'conversationId',auto_id,'requestId',gen_random_uuid(),'message','Outra mensagem','reply','Outra resposta'));
 if (select title from public.personal_assistant_conversations where id=auto_id)<>'Título escolhido' then raise exception 'Manual title overwritten';end if;
 if (select title from public.personal_assistant_conversations where id=a)<>'Synthetic A' then raise exception 'Existing title overwritten';end if;
 begin
  perform public.personal_assistant('rename_conversation',jsonb_build_object('employee',owner_employee,'conversationId',a,'title',' '));
  raise exception 'Empty title accepted';
 exception when others then if sqlerrm<>'Título inválido' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 begin
  perform public.personal_assistant('rename_conversation',jsonb_build_object('employee',other_employee,'conversationId',auto_id,'title','Intrusion'));
  raise exception 'Other owner could rename';
 exception when others then if sqlerrm<>'Conversa indisponível' then raise;end if;end;
 begin
  perform public.personal_assistant('list',jsonb_build_object('employee',other_employee,'conversationId',a));
  raise exception 'Other owner could read';
 exception when others then if sqlerrm<>'Conversa indisponível' then raise;end if;end;
 begin
  perform public.personal_assistant('append',jsonb_build_object('employee',other_employee,'conversationId',a,'requestId',gen_random_uuid(),'message','Intrusion','reply','Intrusion'));
  raise exception 'Other owner could append';
 exception when others then if sqlerrm<>'Conversa indisponível' then raise;end if;end;
 begin
  perform public.personal_assistant('conversations',jsonb_build_object('employee',owner_employee));
  raise exception 'Forged employee accepted';
 exception when others then if sqlerrm<>'Entre novamente para abrir seu assistente' then raise;end if;end;
 if has_table_privilege('authenticated','public.personal_assistant_conversations','SELECT') or has_table_privilege('anon','public.personal_assistant_history','SELECT') then raise exception 'Direct access unexpectedly granted';end if;
 if exists(select 1 from public.personal_assistant_history h join public.personal_assistant_conversations c on c.id=h.conversation_id where h.employee_number<>c.employee_number) then raise exception 'Migrated history has wrong owner';end if;
end $$;
select 'PASS: conversation isolation, ownership, retries and migration integrity' as verification;
rollback;
