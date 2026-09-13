-- Run the existing identity and device checks in one database transaction.
-- The caller keeps the normal authenticated role; each existing RPC retains
-- its own authorization checks. Any failure rolls back claim and activation.
create function public.complete_application_entry(
  p_kind text,
  p_expected_auth_user_id uuid,
  p_employee_number text default null,
  p_password text default null,
  p_profile text default null,
  p_device_key text default '',
  p_device_label text default '',
  p_user_agent text default ''
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid:=auth.uid();
  v_claim jsonb;
  v_identity jsonb;
  v_employee text;
begin
  -- Reject a changed browser session before creating or updating identities.
  if v_uid is null or v_uid is distinct from p_expected_auth_user_id then
    raise exception 'A sessão mudou. Entre novamente.' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('credentials','demo','restore') then
    raise exception 'Tipo de acesso inválido' using errcode='22023';
  end if;
  if p_kind in ('credentials','restore') and nullif(trim(p_employee_number),'') is null then
    raise exception 'Informe o login para confirmar o acesso' using errcode='22023';
  end if;
  if p_kind='credentials' then
    if nullif(p_password,'') is null then
      raise exception 'Informe a senha para confirmar o acesso' using errcode='22023';
    end if;
    v_claim:=public.claim_device_identity(p_employee_number,p_password);
    v_employee:=p_employee_number;
  elsif p_kind='demo' then
    if p_profile is null or p_profile not in ('maintenance_leader','mechanic','commander','coordination','toolroom') then
      raise exception 'Perfil indisponível para demonstração' using errcode='22023';
    end if;
    v_claim:=public.begin_presentation_demo(p_profile);
    v_employee:=v_claim->>'employeeNumber';
  else
    -- Confirm a stored login against the server before activating its device.
    v_claim:=public.refresh_current_device();
    v_employee:=p_employee_number;
  end if;
  if nullif(v_employee,'') is null or v_claim->>'employeeNumber' is distinct from v_employee then
    raise exception 'Não foi possível confirmar o login solicitado' using errcode='42501';
  end if;
  if p_kind='demo' and (
    v_claim->>'accessProfile' is distinct from p_profile
    or v_claim->'isPresentationDemo' is distinct from 'true'::jsonb
    or v_claim->'isAdmin' is distinct from 'false'::jsonb
  ) then
    raise exception 'Não foi possível confirmar o perfil de demonstração' using errcode='42501';
  end if;

  perform public.activate_current_device(p_device_key,p_device_label,p_user_agent);
  v_identity:=public.refresh_current_device();
  if v_identity->>'employeeNumber' is distinct from v_employee then
    raise exception 'O acesso não está mais disponível. Entre novamente.' using errcode='42501';
  end if;
  if p_kind='demo' and (
    v_identity->>'accessProfile' is distinct from p_profile
    or v_identity->'isPresentationDemo' is distinct from 'true'::jsonb
    or v_identity->'isAdmin' is distinct from 'false'::jsonb
  ) then
    raise exception 'O perfil de demonstração mudou. Entre novamente.' using errcode='42501';
  end if;
  return v_identity || jsonb_build_object('authUserId',v_uid);
end;
$$;

revoke all on function public.complete_application_entry(text,uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.complete_application_entry(text,uuid,text,text,text,text,text,text) to authenticated;
