begin;
do $$
declare actor record; n uuid:=gen_random_uuid();r jsonb;plane text;
begin
 select d.* into actor from public.device_identities d join public.authorized_users u using(employee_number) where u.active limit 1;
 perform set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
 r:=public.personal_note('save',jsonb_build_object('employee',actor.employee_number,'id',n,'title','QA no aircraft','prefix','  '));
 if r->>'prefix'<>'' then raise exception 'Optional aircraft failed';end if;
 select p->>'prefix' into plane from public.shared_app_state s cross join lateral jsonb_array_elements(s.catalogs->'aircraft') p where s.id='main' limit 1;
 r:=public.personal_note('save',jsonb_build_object('employee',actor.employee_number,'id',n,'revision',r->'revision','title','QA current aircraft','prefix',plane));
 if r->>'prefix'<>upper(trim(plane)) then raise exception 'Current aircraft failed';end if;
 r:=public.personal_note('save',jsonb_build_object('employee',actor.employee_number,'id',n,'revision',r->'revision','title','QA remove aircraft','prefix',null));
 if r->>'prefix'<>'' then raise exception 'Remove aircraft failed';end if;
end $$;
rollback;
