-- Run only in a transaction: all identities and synthetic records are rolled back.
begin;
do $test$
declare actor uuid; actor_emp text; b text; pilot uuid; pilot_emp text; other_pilot uuid; other_emp text;
 coord uuid; coord_emp text; mech text; r uuid:=gen_random_uuid(); w text; fid text; pc text; wash text; proc text;
 f jsonb; result jsonb; blocked boolean; category text; role_name text; standalone text; oldrev int;
 normal_id text:='qa-normal-'||gen_random_uuid()::text; day text:=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD');
begin
 select d.auth_user_id,d.employee_number,d.assigned_base into actor,actor_emp,b
 from public.device_identities d join public.authorized_users u using(employee_number)
 where u.active and u.job_role in('maintenance_coordinator','maintenance_inspector') and d.assigned_base is not null limit 1;
 select d.auth_user_id,d.employee_number into pilot,pilot_emp from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='commander' limit 1;
 select d.auth_user_id,d.employee_number into other_pilot,other_emp from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='toolroom' limit 1;
 select d.auth_user_id,d.employee_number into coord,coord_emp from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role='coordination' and d.assigned_base=b limit 1;
 select employee_number into mech from public.authorized_users where active and job_role='mechanic' and assigned_base=b limit 1;
 if actor is null or pilot is null or coord is null or mech is null or other_pilot is null then raise exception 'Missing test identities';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 -- A separate employee (not another device of the same pilot), rolled back below.
 update public.authorized_users set job_role='copilot' where employee_number=other_emp;
 update public.shared_app_state set catalogs=jsonb_set(catalogs,'{aircraft}',coalesce(catalogs->'aircraft','[]')||jsonb_build_array(jsonb_build_object('prefix','PR-QAT','model','AW139','base',b))),
 flights=flights||jsonb_build_array(jsonb_build_object('id',normal_id,'prefix','PR-QAT','model','AW139','base',b,'date',day,'departure','08:00','planningStatus','confirmed','commander',pilot_emp,'copilot','','fuel','pending','preflight','pending','hums','pending','engineStart','pending','shutdown','pending','revision',1)) where id='main';
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data,technical_case)
 values(r,'fault',b,'AW139','PR-QAT','urgent','open','QA routing only',actor_emp,'{"description":"QA only","entries":[],"technicalCase":true}','{"report":"report","official":"evaluation","aircraft":"evaluation","investigation":"triage"}');
 -- Every creating leadership role and all operation categories create the card immediately.
 foreach role_name in array array['maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director','admin','app_manager'] loop
  update public.authorized_users set job_role=role_name where employee_number=actor_emp;
  foreach category in array array['Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção'] loop
   execute 'set local role authenticated';
   w:=public.create_maintenance_request(r,category,'QA maintenance flight',array[mech],'','{}');
   execute 'reset role';
   select v into f from public.shared_app_state s,jsonb_array_elements(s.flights) v where s.id='main' and v->>'maintenancePostId'=w;
   if f is null or f->>'planningStatus'<>'planned' or f->>'commander'<>'' or f->>'copilot'<>'' then raise exception 'Missing card or inherited crew: % / %',role_name,category;end if;
   if f->>'maintenanceCategory'<>category then raise exception 'Wrong operation category';end if;
  end loop;
  standalone:=gen_random_uuid()::text;
  execute 'set local role authenticated';
  perform public.create_scoped_activity(standalone,b,'prefix','PR-QAT','',null,'Giro em baixa','QA standalone','','{}','routine','{}','[]');
  execute 'reset role';
  if not exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'maintenancePostId'=standalone and v->>'planningStatus'='planned') then raise exception 'Standalone card missing for %',role_name;end if;
 end loop;
 update public.authorized_users set job_role='maintenance_coordinator' where employee_number=actor_emp;
 fid:=f->>'id';oldrev:=(f->>'revision')::int;
 -- A mechanic assignment is distinct from a pilot assignment.
 perform set_config('request.jwt.claim.sub',pilot::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.list_crew_maintenance_actions() c where c->>'flightId'=fid) then raise exception 'Pilot saw unassigned maintenance';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',coord::text,true);execute 'set local role authenticated';
 select c into result from public.list_maintenance_operation_cards() c where c->>'flightId'=fid;
 if result is null or result->>'planningStatus'<>'planned' then raise exception 'Coordinator cannot see waiting card';end if;
 blocked:=false;begin perform public.configure_maintenance_operation(w,jsonb_build_object('flightId',fid,'commander',pilot_emp,'copilot',pilot_emp));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Duplicate pilot accepted';end if;
 perform public.configure_maintenance_operation(w,jsonb_build_object('flightId',fid,'expectedRevision',oldrev,'date',day,'departure','11:00','commander',pilot_emp,'copilot','','spot','a3'));
 blocked:=false;begin perform public.configure_maintenance_operation(w,jsonb_build_object('flightId',fid,'expectedRevision',oldrev,'departure','12:00'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale programming accepted';end if;
 execute 'reset role';
 select v into f from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'id'=fid;
 if f->>'planningStatus'<>'confirmed' or f->>'commander'<>pilot_emp or f->>'departure'<>'11:00' or f->>'spot'<>'A3' or f->>'maintenancePlannedBy'<>coord_emp then raise exception 'Programming did not persist';end if;
 perform set_config('request.jwt.claim.sub',pilot::text,true);execute 'set local role authenticated';
 if not exists(select 1 from public.list_crew_maintenance_actions() c where c->>'flightId'=fid) then raise exception 'Assigned pilot cannot see action';end if;
 perform public.get_flight_operation(fid);
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',other_pilot::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.list_crew_maintenance_actions() c where c->>'flightId'=fid) then raise exception 'Other pilot sees action';end if;
 execute 'reset role';
 -- Regression: an old client acknowledges a linked activity with the report label.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update public.operational_wall_posts set data=jsonb_set(jsonb_set(data,'{category}','"Relato Técnico"'),'{actions,0,status}','"acknowledged"') where id=w;
 if (select data->>'category' from public.operational_wall_posts where id=w)<>'Voo de manutenção' then raise exception 'Report category overwrote activity';end if;
 if (select count(*) from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'id'=fid and coalesce(v->>'deletedAt','')='')<>1 then raise exception 'Acknowledgement retired or duplicated operation';end if;
 -- Power Check stays on the assigned normal flight; washes only on the runway card.
 pc:=public.create_maintenance_request(r,'Power Check','QA power',array[mech],'','{}');
 wash:=public.create_maintenance_request(r,'Lavagem com produto','QA wash',array[mech],'','{}');
 proc:=public.create_maintenance_request(r,'Procedimentos','QA procedure',array[mech],'','{}');
 if exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'maintenancePostId' in(pc,wash,proc)) then raise exception 'Non-flight action created operation';end if;
 if not exists(select 1 from public.list_runway_wash_requests() q where q->>'postId'=wash) then raise exception 'Wash missing from runway card';end if;
 perform set_config('request.jwt.claim.sub',pilot::text,true);execute 'set local role authenticated';
 select c into result from public.list_crew_maintenance_actions() c where c->>'postId'=pc;
 if result is null or result->>'flightId'<>normal_id then raise exception 'Power Check not tied to assigned normal flight';end if;
 if exists(select 1 from public.list_crew_maintenance_actions() c where c->>'postId' in(wash,proc)) then raise exception 'Wash or procedure leaked to pilot';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',coord::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.list_maintenance_operation_cards() c where c->>'postId' in(pc,wash,proc)) then raise exception 'Internal action leaked to coordinator';end if;
 execute 'reset role';
 update public.device_identities set assigned_base='QA other base' where auth_user_id=coord;
 execute 'set local role authenticated';
 if exists(select 1 from public.list_maintenance_operation_cards() c where c->>'flightId'=fid) then raise exception 'Foreign base projection';end if;
 blocked:=false;begin perform public.configure_maintenance_operation(w,jsonb_build_object('flightId',fid,'departure','12:00'));exception when others then blocked:=true;end;if not blocked then raise exception 'Foreign base planning';end if;
 execute 'reset role';update public.device_identities set assigned_base=b where auth_user_id=coord;
 -- Real source removal still retires the card.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 -- A standalone source can be removed; linked sources remain protected.
 select v->>'id' into fid from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'maintenancePostId'=standalone;
 perform public.delete_own_operational_wall_post(standalone);
 if not exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.flights) v where v->>'id'=fid and v->>'maintenanceSourceDeleted'='true' and coalesce(v->>'deletedAt','')<>'') then raise exception 'Source deletion no longer retires card';end if;
end $test$;
select 'PASS: 7 creating roles, 4 operational categories, standalone, no inherited crew, coordination assignment, selected pilot, legacy category regression, Power Check, wash, procedures, base isolation, revision and source retirement' result;
rollback;
