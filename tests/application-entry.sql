-- Uses transient fixtures and rolls back every account and device mutation.
begin;
do $test$
declare
  visitor uuid;
  person_auth uuid:=gen_random_uuid();
  employee text:='ENTRY-QA-'||replace(gen_random_uuid()::text,'-','');
  password text:=gen_random_uuid()::text;
  profile text;
  identity jsonb;
  blocked boolean;
  prior_key text;
  demo_count bigint;
begin
  if has_function_privilege('anon','public.complete_application_entry(text,uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Anonymous REST role can enter without Auth';
  end if;
  if not has_function_privilege('authenticated','public.complete_application_entry(text,uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Authenticated role cannot call entry';
  end if;
  if (select prosecdef from pg_proc where oid='public.complete_application_entry(text,uuid,text,text,text,text,text,text)'::regprocedure) then
    raise exception 'Entry wrapper unexpectedly elevates privileges';
  end if;
  select count(*) into demo_count from private.presentation_demo_sessions;
  insert into auth.users(id,aud,role,is_anonymous) values(person_auth,'authenticated','authenticated',true);
  insert into public.authorized_users(employee_number,display_name,password_hash,is_admin,access_profile,job_role)
    values(employee,'Transactional entry QA',extensions.crypt(password,extensions.gen_salt('bf')),false,'mechanic','mechanic');

  perform set_config('request.jwt.claim.sub',person_auth::text,true);
  perform set_config('role','authenticated',true);
  blocked:=false;
  begin
    perform public.complete_application_entry('credentials',gen_random_uuid(),employee,password,null,'qa-valid-device-key');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Mismatched Auth UID accepted'; end if;

  blocked:=false;
  begin
    perform public.complete_application_entry('credentials',person_auth,employee,'wrong password',null,'qa-valid-device-key');
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Incorrect password accepted'; end if;
  blocked:=false;
  begin
    perform public.complete_application_entry('credentials',person_auth,employee,null,null,'qa-valid-device-key');
  exception when invalid_parameter_value then blocked:=true;
  end;
  if not blocked then raise exception 'Null password accepted'; end if;
  blocked:=false;
  begin
    perform public.complete_application_entry('credentials',person_auth,employee,'',null,'qa-valid-device-key');
  exception when invalid_parameter_value then blocked:=true;
  end;
  if not blocked then raise exception 'Empty password accepted'; end if;

  -- Failure after a valid claim must undo the newly claimed identity.
  blocked:=false;
  begin
    perform public.complete_application_entry('credentials',person_auth,employee,password,null,'short');
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Invalid device key accepted'; end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.device_identities where auth_user_id=person_auth) then
    raise exception 'Failed activation left a claimed identity';
  end if;

  perform set_config('role','authenticated',true);
  identity:=public.complete_application_entry('credentials',person_auth,employee,password,null,'qa-valid-device-key','QA','SQL regression');
  if identity->>'employeeNumber' is distinct from employee
    or identity->>'accessProfile' is distinct from 'mechanic'
    or identity->>'authUserId' is distinct from person_auth::text then
    raise exception 'Credential entry returned incorrect identity';
  end if;
  identity:=public.complete_application_entry('restore',person_auth,employee,null,null,'qa-valid-device-key','QA','SQL regression');
  if identity->>'employeeNumber' is distinct from employee or identity->>'authUserId' is distinct from person_auth::text then
    raise exception 'Restore returned incorrect identity';
  end if;
  blocked:=false;
  begin
    perform public.complete_application_entry('restore',person_auth,'another-login',null,null,'qa-other-device-key');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Stored login mismatch accepted'; end if;
  perform set_config('role','postgres',true);
  select device_key into prior_key from public.device_identities where auth_user_id=person_auth;
  if prior_key is distinct from 'qa-valid-device-key' then raise exception 'Mismatch changed the device'; end if;

  -- Disabled users and revoked devices may never be restored.
  perform set_config('request.jwt.claim.sub','',true);
  update public.authorized_users set active=false where employee_number=employee;
  perform set_config('request.jwt.claim.sub',person_auth::text,true);
  perform set_config('role','authenticated',true);
  blocked:=false;
  begin
    perform public.complete_application_entry('restore',person_auth,employee,null,null,'qa-valid-device-key');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Disabled user restored'; end if;
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claim.sub','',true);
  update public.authorized_users set active=true where employee_number=employee;
  delete from public.device_identities where auth_user_id=person_auth;
  perform set_config('request.jwt.claim.sub',person_auth::text,true);
  perform set_config('role','authenticated',true);
  blocked:=false;
  begin
    perform public.complete_application_entry('restore',person_auth,employee,null,null,'qa-valid-device-key');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Revoked device restored'; end if;

  foreach profile in array array['maintenance_leader','mechanic','commander','coordination','toolroom'] loop
    visitor:=gen_random_uuid();
    perform set_config('role','postgres',true);
    perform set_config('request.jwt.claim.sub','',true);
    insert into auth.users(id,aud,role,is_anonymous) values(visitor,'authenticated','authenticated',true);
    perform set_config('request.jwt.claim.sub',visitor::text,true);
    perform set_config('role','authenticated',true);
    -- A failed activation must also undo the demo account and private mapping.
    blocked:=false;
    begin
      perform public.complete_application_entry('demo',visitor,null,null,profile,'short');
    exception when raise_exception then blocked:=true;
    end;
    if not blocked then raise exception 'Invalid demo activation accepted'; end if;
    perform set_config('role','postgres',true);
    if exists(select 1 from private.presentation_demo_sessions where auth_user_id=visitor)
      or exists(select 1 from public.device_identities where auth_user_id=visitor)
      or exists(select 1 from public.authorized_users where employee_number='DEMO-'||replace(visitor::text,'-','')) then
      raise exception 'Failed demo activation left partial state';
    end if;
    perform set_config('role','authenticated',true);
    identity:=public.complete_application_entry('demo',visitor,null,null,profile,'qa-demo-'||visitor::text,'QA','SQL regression');
    if identity->>'accessProfile' is distinct from profile
      or identity->'isAdmin' is distinct from 'false'::jsonb
      or identity->'isPresentationDemo' is distinct from 'true'::jsonb
      or identity->>'authUserId' is distinct from visitor::text then
      raise exception 'Demo returned incorrect identity for %',profile;
    end if;
    identity:=public.complete_application_entry('restore',visitor,identity->>'employeeNumber',null,null,'qa-demo-'||visitor::text);
    if identity->>'accessProfile' is distinct from profile or identity->'isPresentationDemo' is distinct from 'true'::jsonb then
      raise exception 'Demo restore lost profile';
    end if;
    blocked:=false;
    begin
      perform public.complete_application_entry('demo',visitor,null,null,'admin','qa-demo-'||visitor::text);
    exception when invalid_parameter_value then blocked:=true;
    end;
    if not blocked then raise exception 'Administrator demo accepted'; end if;
    blocked:=false;
    begin
      perform public.complete_application_entry('demo',visitor,null,null,'app_manager','qa-demo-'||visitor::text);
    exception when invalid_parameter_value then blocked:=true;
    end;
    if not blocked then raise exception 'Application manager demo accepted'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  blocked:=false;
  begin
    perform public.complete_application_entry('demo',visitor,null,null,'mechanic','qa-valid-device-key');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Missing session accepted'; end if;
  perform set_config('role','postgres',true);
  if (select count(*) from private.presentation_demo_sessions)<>demo_count+5 then
    raise exception 'Unexpected number of demo accounts';
  end if;
end;
$test$;
rollback;
select 'PASS: exact Auth UID, credentials, null and wrong passwords, restore identity, disabled user, revoked device, five demo roles, no elevated demo roles, invoker permissions and atomic rollback; all fixtures rolled back' as result;
