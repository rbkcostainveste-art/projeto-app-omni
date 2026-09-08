begin;
create or replace function private.technical_actor() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('employee',d.employee_number,'name',u.display_name,'role',coalesce(u.job_role,u.access_profile),'admin',d.is_admin or u.access_profile in('admin','app_manager'),'base',d.assigned_base)
 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active
$$;
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=regexp_replace(f,'valid_aprs:=nullif\(c->>''aprsRef'',''''\)[[:space:]]+is not null and nullif\(c->>''aprsBy'',''''\) is not null;',
 'valid_aprs:=nullif(c->>''aprsRef'','''') is not null and nullif(c->>''aprsBy'','''') is not null and (nullif(c->>''lastAdverseAt'','''') is null or (c->>''aprsAt'')::timestamptz>(c->>''lastAdverseAt'')::timestamptz);');
 if strpos(f,'(c->>''aprsAt'')::timestamptz>(c->>''lastAdverseAt'')')=0 then raise exception 'Freshness guard not installed';end if;
 f:=replace(f,'if nullif(c->>''aprsRef'','''') is distinct from nullif(o->>''aprsRef'','''') then','if coalesce((c->>''confirmAprs'')::boolean,false) or nullif(c->>''aprsRef'','''') is distinct from nullif(o->>''aprsRef'','''') then');
 f:=replace(f,'if d is distinct from coalesce(o->''disposition'',''{}'') then','if coalesce((c->>''confirmDisposition'')::boolean,false) or d is distinct from coalesce(o->''disposition'',''{}'') then');
 f:=replace(f,'''notApplicableBy'',a->>''employee''','''notApplicableName'',a->>''name'',''notApplicableBy'',a->>''employee''');
 f:=replace(f,'''notApplicableBy'',o->>''notApplicableBy''','''notApplicableName'',o->>''notApplicableName'',''notApplicableBy'',o->>''notApplicableBy''');
 f:=replace(f,'''aprsBy'',a->>''employee''','''aprsName'',a->>''name'',''aprsBy'',a->>''employee''');
 f:=replace(f,'''aprsBy'',o->>''aprsBy''','''aprsName'',o->>''aprsName'',''aprsBy'',o->>''aprsBy''');
 f:=replace(f,'''authorizedBy'',a->>''employee''','''authorizedName'',a->>''name'',''authorizedBy'',a->>''employee''');
 f:=replace(f,'(d->>''deadline'')::timestamptz>now();','(d->>''deadline'')::timestamptz>now() and (nullif(c->>''lastAdverseAt'','''') is null or (d->>''authorizedAt'')::timestamptz>(c->>''lastAdverseAt'')::timestamptz);');
 f:=replace(f,'new.technical_case:=c;','new.technical_case:=c-''confirmAprs''-''confirmDisposition'';');
 f:=replace(f,'now()','clock_timestamp()');
 execute f;
end $$;
commit;
