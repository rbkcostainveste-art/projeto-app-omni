begin;
do $test$
declare
  visitor uuid; role_name text; claim jsonb; again jsonb; employee text;
  previous_employee text; blocked boolean; existing uuid; count_before bigint;
  note_id uuid; previous_note uuid; note jsonb;
begin
  if has_function_privilege('anon','public.begin_presentation_demo(text)','EXECUTE') then raise exception 'Anonymous REST role can start without Auth'; end if;
  if has_table_privilege('authenticated','private.presentation_demo_sessions','SELECT') then raise exception 'Private demo map exposed'; end if;
  select count(*) into count_before from private.presentation_demo_sessions;
  foreach role_name in array array['maintenance_leader','mechanic','commander','coordination','toolroom'] loop
    visitor:=gen_random_uuid();
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('role','postgres',true);
    insert into auth.users(id,aud,role,is_anonymous) values(visitor,'authenticated','authenticated',true);
    perform set_config('request.jwt.claim.sub',visitor::text,true);
    perform set_config('role','authenticated',true);
    claim:=public.begin_presentation_demo(role_name);
    employee:=claim->>'employeeNumber';
    if claim->>'accessProfile'<>role_name or (claim->>'isAdmin')::boolean or not (claim->>'isPresentationDemo')::boolean or employee not like 'DEMO-%' then raise exception 'Incorrect identity for %',role_name; end if;
    if previous_employee=employee then raise exception 'Visitor identity reused'; end if;
    previous_employee:=employee;
    again:=public.begin_presentation_demo(role_name);
    if again->>'employeeNumber'<>employee then raise exception 'Idempotent start failed'; end if;
    perform public.activate_current_device('qa-demo-device-'||visitor::text,'Presentation QA','SQL regression');
    again:=public.refresh_current_device();
    if again->>'employeeNumber'<>employee or again->>'accessProfile'<>role_name or not (again->>'isPresentationDemo')::boolean then raise exception 'Refresh lost identity'; end if;
    if not public.confirm_presentation_demo_action() then raise exception 'Demo write confirmation failed'; end if;
    note_id:=gen_random_uuid();
    note:=public.personal_note('save',jsonb_build_object('employee',employee,'id',note_id,'title','QA demonstração','body','Persistência autorizada - '||role_name));
    if note->>'employee_number'<>employee or note->>'body'<>'Persistência autorizada - '||role_name then raise exception 'Note save failed for %',role_name; end if;
    note:=public.personal_note('get',jsonb_build_object('employee',employee,'id',note_id));
    if note->>'body'<>'Persistência autorizada - '||role_name then raise exception 'Persisted note read failed for %',role_name; end if;
    if previous_note is not null then
      blocked:=false;
      begin perform public.personal_note('get',jsonb_build_object('employee',employee,'id',previous_note)); exception when raise_exception then blocked:=true; end;
      if not blocked then raise exception 'Visitor can read another visitor personal note'; end if;
    end if;
    previous_note:=note_id;
    blocked:=false;
    begin perform public.begin_presentation_demo('admin'); exception when invalid_parameter_value then blocked:=true; end;
    if not blocked then raise exception 'Admin demo accepted'; end if;
    blocked:=false;
    begin perform public.begin_presentation_demo('app_manager'); exception when invalid_parameter_value then blocked:=true; end;
    if not blocked then raise exception 'Manager demo accepted'; end if;
    blocked:=false;
    begin perform public.begin_presentation_demo(case when role_name='mechanic' then 'commander' else 'mechanic' end); exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Profile changed in existing identity'; end if;
    if role_name='coordination' then
      blocked:=false;
      begin perform public.set_user_access_context(employee,'admin',claim->>'assignedBase','{}'); exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Coordination demo escalated to admin'; end if;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  blocked:=false;
  begin perform public.begin_presentation_demo('mechanic'); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'No-session request accepted'; end if;
  blocked:=false;
  begin perform public.confirm_presentation_demo_action(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'No-session confirmation accepted'; end if;
  perform set_config('role','postgres',true);
  select d.auth_user_id into existing from public.device_identities d
    where not exists(select 1 from private.presentation_demo_sessions s where s.auth_user_id=d.auth_user_id) limit 1;
  if existing is not null then
    perform set_config('request.jwt.claim.sub',existing::text,true);
    perform set_config('role','authenticated',true);
    blocked:=false;
    begin perform public.begin_presentation_demo('mechanic'); exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Existing person identity overwritten by demo'; end if;
    blocked:=false;
    begin perform public.confirm_presentation_demo_action(); exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Demo confirmation signed a regular identity'; end if;
  end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('role','postgres',true);
  if (select count(*) from private.presentation_demo_sessions)<>count_before+5 then raise exception 'Unexpected number of demo identities'; end if;
end;
$test$;
rollback;
select 'PASS: five exclusive demo profiles, persisted note write and read per profile, private notes isolated, idempotence, active device refresh, confirmation, admin escalation blocked, existing identity preserved; all fixtures rolled back' as result;
