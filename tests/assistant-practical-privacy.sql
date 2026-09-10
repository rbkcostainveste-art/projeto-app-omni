-- Synthetic records only; this transaction is always rolled back.
begin;
do $$
declare conversation uuid:=gen_random_uuid(); media_path text; owner_id uuid; other_id uuid; employee text; object_name text; rec public.maintenance_records; original jsonb; result jsonb; flight_id text:=gen_random_uuid()::text;
begin
 select d.auth_user_id,d.employee_number into owner_id,employee from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1;
 select d.auth_user_id into other_id from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.auth_user_id<>owner_id limit 1;
 if owner_id is null or other_id is null then raise exception 'Two active test identities required';end if;
 if not exists(select 1 from storage.buckets where id='assistant-inputs' and not public and file_size_limit=20971520) then raise exception 'Private bucket missing';end if;
 object_name:=owner_id::text||'/'||gen_random_uuid()::text||'.png';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 insert into storage.objects(bucket_id,name) values('assistant-inputs',object_name);
 if not exists(select 1 from storage.objects where bucket_id='assistant-inputs' and name=object_name) then raise exception 'Owner cannot read input';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if exists(select 1 from storage.objects where bucket_id='assistant-inputs' and name=object_name) then raise exception 'Other user can read input';end if;
 begin
  insert into storage.objects(bucket_id,name) values('assistant-inputs',owner_id::text||'/'||gen_random_uuid()::text||'.png');
  raise exception 'Other user can upload into owner path';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data)
 values(gen_random_uuid(),'fault','QA','S92','PR-QAT','not_logged','open','Altímetro','QA-TC',employee,'{"description":"intermitente em voo","entries":[]}') returning * into rec;
 original:=rec.technical_case->'originalObservation';
 if original->>'description'<>'intermitente em voo' then raise exception 'Original observation not captured';end if;
 perform public.technical_case_action('update',rec.id,jsonb_build_object('revision',rec.revision,'title','Indicação do altímetro','description','Indicação intermitente durante o voo.','case',rec.technical_case||'{"reason":"QA synthetic correction","originalObservation":{"description":"forged"}}'));
 select * into rec from public.maintenance_records where id=rec.id;
 if rec.technical_case->'originalObservation' is distinct from original then raise exception 'Original observation changed';end if;
 if rec.data->>'description'<>'Indicação intermitente durante o voo.' then raise exception 'Correction not applied';end if;
 if not exists(select 1 from public.technical_case_audit where record_id=rec.id) then raise exception 'Audit missing';end if;
 if not exists(select 1 from storage.buckets where id='internal-chat' and 'application/pdf'=any(allowed_mime_types) and not public) then raise exception 'PDF not enabled in private chat';end if;
 insert into public.internal_conversations(id,title,created_by) values(conversation,'QA owner-only PDF test',employee);
 insert into public.internal_conversation_members(conversation_id,employee_number,added_by) values(conversation,employee,employee);
 media_path:=conversation::text||'/'||owner_id::text||'/'||gen_random_uuid()::text||'.pdf';
 insert into storage.objects(bucket_id,name) values('internal-chat',media_path);
 result:=public.internal_chat('send',jsonb_build_object('id',conversation,'requestId',gen_random_uuid(),'body','QA synthetic PDF','attachments',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','synthetic.pdf','type','document','bucket','internal-chat','url',media_path))));
 if not exists(select 1 from public.internal_messages where id=(result->>'id')::bigint and attachments->0->>'type'='document') then raise exception 'PDF message not saved';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if private.chat_member(conversation::text) then raise exception 'PDF chat privacy lost';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result:=public.mutate_shared_item('flights',flight_id,jsonb_build_object('prefix','PR-QAT','base','QA','model','S92','date','2026-09-10','departure','','destination','','duration',0,'fuelAmount',0,'fuelUnit','L','planningStatus','planned','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown','pending'),'create');
 if result->'item'->>'planningStatus'<>'planned' or result->'item'->>'departure'<>'' then raise exception 'Incomplete plan did not persist';end if;
end $$;
rollback;
