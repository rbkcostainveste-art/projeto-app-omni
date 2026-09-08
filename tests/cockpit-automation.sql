begin;
do $$
declare pilot uuid; employee text; other_user uuid; row jsonb; identifier text:=gen_random_uuid()::text; path text; rejected boolean;
begin
 select d.auth_user_id,u.employee_number into pilot,employee from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='commander' limit 1;
 select d.auth_user_id into other_user from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='mechanic' and not d.is_admin limit 1;
 if pilot is null or other_user is null then raise exception 'Test identities unavailable';end if;
 perform set_config('request.jwt.claim.sub',pilot::text,true);
 row:=public.cockpit('save',jsonb_build_object('id',identifier,'kind','duty','subject',employee,'data',jsonb_build_object('date','2026-09-08','presentation','2026-09-08T10:00:00Z','mealStart','2026-09-08T12:00:00Z','flightMinutes','15')));
 if row->'data'->>'release' is not null then raise exception 'Duty closed automatically';end if;
 rejected:=false;
 begin
  perform public.cockpit('save',jsonb_build_object('id',identifier,'kind','duty','subject',employee,'revision',row->'revision','data',(row->'data')||jsonb_build_object('release','2026-09-08T16:00:00Z')));
 exception when others then rejected:=true;end;
 if not rejected then raise exception 'Open meal incorrectly allowed on release';end if;
 row:=public.cockpit('save',jsonb_build_object('id',identifier,'kind','duty','subject',employee,'revision',row->'revision','data',(row->'data')||jsonb_build_object('mealEnd','2026-09-08T13:00:00Z','release','2026-09-08T16:00:00Z')));
 if (row->'data'->>'elapsedMinutes')::int<>360 or (row->'data'->>'mealMinutes')::int<>60 then raise exception 'Duty totals incorrect';end if;
 identifier:=gen_random_uuid()::text;path:=pilot::text||'/'||identifier||'/test';
 if not public.cockpit_occurrence_media_access(path,true) then raise exception 'Pilot upload rejected';end if;
 insert into storage.objects(bucket_id,name) values('cockpit-occurrence-media',path);
 row:=public.cockpit('save',jsonb_build_object('id',identifier,'kind','occurrence','data',jsonb_build_object('title','Rollback test','description','No location required','mediaJson',jsonb_build_array(jsonb_build_object('id','test','name','test.png','type','image','url',path,'bucket','cockpit-occurrence-media'))::text)));
 if not public.cockpit_occurrence_media_access(path,false) then raise exception 'Creator cannot read saved media';end if;
 rejected:=false;
 begin
  perform public.cockpit('save',jsonb_build_object('id',identifier,'revision',row->'revision','data',(row->'data')||jsonb_build_object('latitude','91')));
 exception when others then rejected:=true;end;
 if not rejected then raise exception 'Invalid coordinates accepted';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 if public.cockpit_occurrence_media_access(path,false) or public.cockpit_occurrence_media_access(path,true) then raise exception 'Unrelated user has media access';end if;
end $$;
select 'PASS: duty numeric totals, ongoing meal, explicit release, optional coordinates, private media' as result;
rollback;
