begin;
do $test$
declare author_d public.device_identities; target_d public.device_identities; other_d public.device_identities; post_id text; c text; payload jsonb;
begin
 select * into author_d from public.device_identities where access_profile='leader_inspector' limit 1;
 select * into target_d from public.device_identities where access_profile='mechanic' limit 1;
 select * into other_d from public.device_identities where access_profile='mechanic' and employee_number<>target_d.employee_number limit 1;
 if author_d.auth_user_id is null or target_d.auth_user_id is null or other_d.auth_user_id is null then raise exception 'Missing fixture identities';end if;
 perform set_config('request.jwt.claim.sub',author_d.auth_user_id::text,true);
 perform set_config('qa.target',target_d.auth_user_id::text,true);perform set_config('qa.other',other_d.auth_user_id::text,true);
 foreach c in array array['Momento F.O.D','DDS','Avisos','Comunicados','Determinação'] loop
  post_id:='qa-notice-'||gen_random_uuid();
  payload:=jsonb_build_object('id',post_id,'createdBy',author_d.employee_number,'category',c,'title',c,'body','','actions','[]'::jsonb,'audienceRecipients',jsonb_build_array(target_d.employee_number),'attachments',jsonb_build_array(jsonb_build_object('type','image','url','demo')));
  insert into public.operational_wall_posts(id,base,audience_area,data) values(post_id,'Todas','maintenance',payload);
 end loop;
 perform set_config('qa.post',post_id,true);
 insert into public.operational_wall_posts(id,base,audience_area,data) values('qa-broadcast-'||gen_random_uuid(),'Todas','maintenance',payload||jsonb_build_object('audienceRecipients','[]'::jsonb));
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.target'),true);
do $test$ begin
 if (select count(*) from public.operational_wall_posts where id like 'qa-notice-%')<>5 then raise exception 'Selected user cannot read all categories';end if;
 if not exists(select 1 from public.operational_wall_posts where id like 'qa-broadcast-%') then raise exception 'Empty audience not broadcast';end if;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('qa.other'),true);
do $test$ declare blocked boolean:=false;begin
 if exists(select 1 from public.operational_wall_posts where id like 'qa-notice-%') then raise exception 'Audience leak';end if;
 if not exists(select 1 from public.operational_wall_posts where id like 'qa-broadcast-%') then raise exception 'Broadcast hidden';end if;
 begin perform public.add_operational_wall_comment(current_setting('qa.post'),'Forbidden','[]');exception when others then blocked:=true;end;
 if not blocked then raise exception 'Excluded user can comment through RPC';end if;
end $test$;
reset role;
rollback;
select 'PASS: all five categories, media-only notices, selected audience, broadcast, RLS and RPC exclusion' result;
