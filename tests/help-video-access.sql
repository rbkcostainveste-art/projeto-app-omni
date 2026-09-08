begin;
do $test$
declare adm uuid; staff uuid; vid uuid:=gen_random_uuid(); blocked boolean;
begin
 select d.auth_user_id into adm from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.is_admin limit 1;
 select d.auth_user_id into staff from public.device_identities d join public.authorized_users u using(employee_number) where u.active and not d.is_admin and u.access_profile not in ('admin','app_manager') and coalesce(u.job_role,'')<>'app_manager' limit 1;
 if adm is null or staff is null then raise exception 'Missing test identities';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform set_config('role','authenticated',true);
 if not public.help_video_admin() then raise exception 'Admin denied';end if;
 insert into public.help_videos(id,title,profile,screen,storage_path,enabled) values(vid,'QA video','coordination','wall','qa-test/'||vid||'.mp4',false);
 perform set_config('request.jwt.claim.sub',staff::text,true);
 if public.help_video_admin() then raise exception 'Staff allowed admin access';end if;
 if exists(select 1 from public.help_videos where id=vid) then raise exception 'Draft exposed';end if;
 blocked:=false;begin insert into public.help_videos(title,profile,screen,storage_path) values('blocked','all','wall','no.mp4');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Unauthorized insert succeeded';end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 update public.help_videos set enabled=true where id=vid;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 if not exists(select 1 from public.help_videos where id=vid) then raise exception 'Published missing';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.help_videos where id=vid) then raise exception 'Unidentified access';end if;
end $test$;
rollback;
select 'PASS help catalog: admin management, employee read, drafts hidden, unauthenticated denied' result;
