begin;
do $test$
declare actor uuid; p text; b text; f jsonb; caught boolean;
begin
 select d.auth_user_id,d.assigned_base into actor,b from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='coordination' and d.assigned_base is not null limit 1;
 select employee_number into p from public.authorized_users where active and job_role='commander' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update public.shared_app_state set catalogs=jsonb_set(catalogs,'{aircraft}',catalogs->'aircraft'||jsonb_build_array(jsonb_build_object('prefix','PR-QSC','base',b,'model','S92'))) where id='main';
 f:=jsonb_build_object('id','qa-scheduling-base','prefix','PR-QSC','base',b,'model','S92','date',current_date,'departure','08:00','commander',p);
 perform public.update_user_operational_assignment(p,'Other',array['S92'],'','');
 caught:=false;begin update public.shared_app_state set flights=flights||jsonb_build_array(f) where id='main';exception when others then caught:=sqlerrm like '%fora da base%';end;
 if not caught then raise exception 'Wrong base accepted';end if;
 perform public.update_user_operational_assignment(p,b,array['AW139'],'','');
 caught:=false;begin update public.shared_app_state set flights=flights||jsonb_build_array(f) where id='main';exception when others then caught:=sqlerrm like '%sem habilitação%';end;
 if not caught then raise exception 'Wrong fleet accepted';end if;
 perform public.update_user_operational_assignment(p,b,array['S92'],'','');
 update public.shared_app_state set flights=flights||jsonb_build_array(f) where id='main';
 if not exists(select 1 from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) v where v->>'id'='qa-scheduling-base') then raise exception 'Eligible crew rejected';end if;
 perform public.update_user_operational_assignment(p,'Other',array['S92'],'','');
 update public.shared_app_state set flights=(select jsonb_agg(case when v->>'id'='qa-scheduling-base' then v||'{"departure":"09:00"}'::jsonb else v end) from jsonb_array_elements(flights) v) where id='main';
end $test$;
select 'PASS wrong base/fleet blocked; transfer plus qualification enables assignment; existing assignments preserved' result;
rollback;
