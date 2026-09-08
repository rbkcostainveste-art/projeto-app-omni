begin;
do $$
declare a record;b record;first_id uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();r jsonb;
begin
 select d.* into a from public.device_identities d join public.authorized_users u using(employee_number) where u.active limit 1;
 select d.* into b from public.device_identities d join public.authorized_users u using(employee_number) where u.active and d.employee_number<>a.employee_number limit 1;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 perform public.personal_note('save',jsonb_build_object('employee',a.employee_number,'id',second_id,'title','qa-agenda-unique later','remindAt',now()+interval '2 days'));
 perform public.personal_note('save',jsonb_build_object('employee',a.employee_number,'id',first_id,'title','qa-agenda-unique earlier','remindAt',now()+interval '1 day'));
 r:=public.personal_note('agenda',jsonb_build_object('employee',a.employee_number,'search','qa-agenda-unique'));
 if jsonb_array_length(r)<>2 or r->0->>'id'<>first_id::text then raise exception 'Agenda order failed';end if;
 r:=public.personal_note('agenda',jsonb_build_object('employee',a.employee_number,'search','qa-agenda-unique','before',r->0->>'remind_at','beforeId',first_id));
 if jsonb_array_length(r)<>1 or r->0->>'id'<>second_id::text then raise exception 'Agenda cursor failed';end if;
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 r:=public.personal_note('agenda',jsonb_build_object('employee',b.employee_number,'search','qa-agenda-unique'));
 if jsonb_array_length(r)<>0 then raise exception 'Agenda privacy failed';end if;
end $$;
rollback;
