begin;
-- Claimed device identities are still checked for anonymous Supabase Auth sessions.
select set_config('request.jwt.claim.sub',(select d.auth_user_id::text from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1),true);
set local role authenticated;
do $$
declare blocked boolean;
begin
 perform count(*) from public.technical_case_audit;
 blocked:=false;begin update public.technical_case_audit set reason='forged';exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Audit writable';end if;
 blocked:=false;begin delete from public.technical_case_audit;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Audit deletable';end if;
 blocked:=false;begin select count(*) from private.technical_operator_config;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Direct operator config accessible';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
declare blocked boolean;
begin
 blocked:=false;begin perform public.technical_case_action('config');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous RPC executable';end if;
 blocked:=false;begin perform count(*) from public.technical_case_alerts;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous alerts accessible';end if;
end $$;
reset role;
rollback;
