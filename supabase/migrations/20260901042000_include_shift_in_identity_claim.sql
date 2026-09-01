create or replace function public.claim_device_identity(p_employee_number text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user public.authorized_users; v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  select * into v_user from public.authorized_users where employee_number=p_employee_number and active;
  if v_user.id is null or v_user.password_hash<>extensions.crypt(p_password,v_user.password_hash) then raise exception 'Matrícula ou senha inválida'; end if;
  insert into public.device_identities(auth_user_id,employee_number,is_admin,access_profile,assigned_base,fleets,mission,work_shift)
  values(v_uid,v_user.employee_number,v_user.is_admin,v_user.access_profile,v_user.assigned_base,v_user.fleets,v_user.mission,v_user.work_shift)
  on conflict(auth_user_id) do update set employee_number=excluded.employee_number,is_admin=excluded.is_admin,access_profile=excluded.access_profile,assigned_base=excluded.assigned_base,fleets=excluded.fleets,mission=excluded.mission,work_shift=excluded.work_shift,claimed_at=now();
  return jsonb_build_object('employeeNumber',v_user.employee_number,'isAdmin',v_user.is_admin,'accessProfile',v_user.access_profile,'assignedBase',v_user.assigned_base,'fleets',v_user.fleets,'mission',v_user.mission,'workShift',v_user.work_shift);
end $$;

revoke all on function public.claim_device_identity(text,text) from public,anon;
grant execute on function public.claim_device_identity(text,text) to authenticated;
