begin;
do $$
declare adm uuid; pilot uuid; employee text; plane text; other_plane text; day text:=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'); fid text:=gen_random_uuid()::text; taskid uuid:=gen_random_uuid(); blocked boolean; visible_count int; next_catalog jsonb;
begin
 select d.auth_user_id into adm from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='admin' and u.active limit 1;
 select d.auth_user_id,d.employee_number into pilot,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.job_role='commander' and u.active limit 1;
 if adm is null or pilot is null then raise exception 'Missing fixture identities';end if;
 select catalogs#>>'{aircraft,0,prefix}',catalogs#>>'{aircraft,1,prefix}' into plane,other_plane from public.shared_app_state where id='main';
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set catalogs=jsonb_set(catalogs,'{aircraft}',(select jsonb_agg(case when a->>'prefix'=plane then a||'{"base":"QA-A"}'::jsonb when a->>'prefix'=other_plane then a||'{"base":"QA-B"}'::jsonb else a end) from jsonb_array_elements(catalogs->'aircraft') a)),
 flights=jsonb_build_array(jsonb_build_object('id',fid,'prefix',plane,'commander',employee,'date',day,'departure','10:00','base','OLD','revision',1)) where id='main';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if private.current_crew_base() is distinct from 'QA-A' then raise exception 'Upcoming allocation failed';end if;
 if exists(select 1 from public.authorized_users where employee_number=employee and assigned_base is not null) then raise exception 'Fixed base remains';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 insert into public.compressor_drying_tasks(id,source_type,source_id,prefix,model,base,reason,status,completed_at) values(taskid,'wall_action',fid,other_plane,'S92','QA-B','transactional test','completed',now());
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 execute 'set local role authenticated';select count(*) into visible_count from public.compressor_drying_tasks where id=taskid;execute 'reset role';if visible_count<>0 then raise exception 'Queue exposed outside base';end if;
 blocked:=false;
 begin perform public.complete_compressor_drying(taskid);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Cross base completion allowed';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set catalogs=jsonb_set(catalogs,'{aircraft}',(select jsonb_agg(case when a->>'prefix'=plane then a||'{"base":"QA-B"}'::jsonb else a end) from jsonb_array_elements(catalogs->'aircraft') a)) where id='main';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if private.current_crew_base() is distinct from 'QA-B' then raise exception 'Aircraft relocation failed';end if;
 execute 'set local role authenticated';select count(*) into visible_count from public.compressor_drying_tasks where id=taskid;execute 'reset role';if visible_count<>1 then raise exception 'Queue unavailable in current base';end if;
 perform public.complete_compressor_drying(taskid);
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.shared_app_state set flights=jsonb_set(flights,'{0,cancelled}','true') where id='main';
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 if private.current_crew_base() is not null then raise exception 'Cancelled allocation retained base';end if;
 blocked:=false;
 begin perform public.complete_compressor_drying(taskid);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Unallocated pilot allowed completion';end if;
end $$;
select 'PASS: allocation, aircraft transfer, no fixed base, same/cross base completion and cancelled allocation' result;
rollback;
