begin;
do $test$
declare a public.device_identities;b public.device_identities;other public.device_identities; r1 uuid:=gen_random_uuid();r2 uuid:=gen_random_uuid();c1 uuid;c2 uuid;res jsonb;blocked boolean;
begin
 select d.* into a from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.access_profile='leader_inspector' limit 1;
 select d.* into b from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.access_profile='mechanic' and d.assigned_base=a.assigned_base limit 1;
 select d.* into other from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.access_profile='mechanic' and d.assigned_base=a.assigned_base and d.employee_number<>b.employee_number limit 1;
 if other.auth_user_id is null then raise exception 'Missing fixtures';end if;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,title,created_by,data) values
 (r1,'fault',a.assigned_base,'QA','QA-TEST','QA first',a.employee_number,jsonb_build_object('links',jsonb_build_array(r2))),
 (r2,'fault',a.assigned_base,'QA','QA-TEST','QA second',a.employee_number,jsonb_build_object('links',jsonb_build_array(r1)));
 c1:=(public.maintenance_chat('open',r1,jsonb_build_array(b.employee_number))->>'id')::uuid;
 c2:=(public.maintenance_chat('open',r2,jsonb_build_array(other.employee_number))->>'id')::uuid;
 if c1=c2 then raise exception 'Linked conversations merged';end if;
 if (public.maintenance_chat('open',r1)->>'id')::uuid<>c1 then raise exception 'Duplicate conversation';end if;
 perform public.internal_chat('send',jsonb_build_object('id',c1,'requestId',gen_random_uuid(),'body','QA first record only'));
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 res:=public.maintenance_chat('summary',r1);
 if jsonb_array_length(res->'links')<>1 or res#>>'{conversation,message_count}'<>'1' then raise exception 'Summary or links missing';end if;
 blocked:=false;begin perform public.maintenance_chat('open',r2);exception when others then blocked:=true;end;if not blocked then raise exception 'Linked pane leaked membership';end if;
 res:=public.maintenance_chat('summary',r2);
 if res->'conversation'<>'null'::jsonb then raise exception 'Other conversation exposed';end if;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 update public.maintenance_records set status='closed' where id=r1;
 if (public.maintenance_chat('summary',r1)#>>'{conversation,id}')::uuid<>c1 then raise exception 'Closed history lost';end if;
end $test$;
rollback;
select 'PASS: unique chats, separate linked histories and participants, summaries, private access and closed history' result;
