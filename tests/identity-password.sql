begin;
do $test$
declare
  visitor uuid:=gen_random_uuid();
  employee text:='PASSWORD-QA-'||replace(gen_random_uuid()::text,'-','');
  password text:=gen_random_uuid()::text;
  invalid_password text;
  identity jsonb;
  blocked boolean;
begin
  insert into auth.users(id,aud,role,is_anonymous) values(visitor,'authenticated','authenticated',true);
  insert into public.authorized_users(employee_number,display_name,password_hash,is_admin,access_profile,job_role)
    values(employee,'Transactional password QA',extensions.crypt(password,extensions.gen_salt('bf')),false,'mechanic','mechanic');
  perform set_config('request.jwt.claim.sub',visitor::text,true);
  perform set_config('role','authenticated',true);
  foreach invalid_password in array array[null::text,'','wrong password'] loop
    blocked:=false;
    begin
      perform public.claim_device_identity(employee,invalid_password);
    exception when raise_exception then blocked:=true;
    end;
    if not blocked then raise exception 'Legacy RPC accepted invalid password'; end if;
  end loop;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.device_identities where auth_user_id=visitor) then
    raise exception 'Invalid credentials created an identity';
  end if;
  perform set_config('role','authenticated',true);
  identity:=public.claim_device_identity(employee,password);
  if identity->>'employeeNumber' is distinct from employee or identity->>'accessProfile' is distinct from 'mechanic' then
    raise exception 'Valid legacy claim returned the wrong identity';
  end if;
  -- Invalid reclaims must leave an existing correctly claimed identity intact.
  blocked:=false;
  begin
    perform public.claim_device_identity(employee,null);
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Null password accepted after a successful claim'; end if;
  perform set_config('role','postgres',true);
  if (select employee_number from public.device_identities where auth_user_id=visitor) is distinct from employee then
    raise exception 'Invalid reclaim changed the existing identity';
  end if;
end;
$test$;
rollback;
select 'PASS: direct legacy RPC rejects NULL, empty and incorrect passwords, preserves valid login and identity; all fixtures rolled back' as result;
