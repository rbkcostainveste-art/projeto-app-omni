begin;
do $$
declare administrator uuid; member_id uuid; employee text; target_base text:='Jacarepaguá'; prefix text; result jsonb;
begin
 select auth_user_id into administrator from public.device_identities where job_role='admin' limit 1;
 select d.auth_user_id,d.employee_number into member_id,employee from public.device_identities d join public.authorized_users u using(employee_number) where not d.is_admin and u.active and coalesce(d.job_role,d.access_profile) in ('mechanic','coordination') limit 1;
 if administrator is null or member_id is null then raise exception 'Authorized test identities unavailable';end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 execute 'set local role authenticated';
 -- Changing role must discard old fleet/shift assignments without losing the base.
 perform public.set_user_access_context(employee,'mechanic',target_base,array['S92']);
 perform public.update_user_operational_assignment(employee,target_base,array['S92'],'mission_1','day');
 perform public.set_user_access_context(employee,'coordination',target_base,array['S92']);
 execute 'reset role';
 if exists(select 1 from public.authorized_users where employee_number=employee and (assigned_base is distinct from target_base or fleets<>'{}' or mission is not null or work_shift is not null)) then raise exception 'Role transition retains obsolete assignments';end if;
 execute 'set local role authenticated';
 -- Same RPC used by the reported Base selector, including stale input from old UI.
 perform public.update_user_operational_assignment(employee,'Macaé',array['S92'],'mission_2','night');
 execute 'reset role';
 if not exists(select 1 from public.authorized_users where employee_number=employee and assigned_base='Macaé' and fleets='{}' and mission is null and work_shift is null) then raise exception 'Coordination base not saved';end if;
 if exists(select 1 from public.device_identities where employee_number=employee and (assigned_base is distinct from 'Macaé' or fleets<>'{}' or mission is not null or work_shift is not null)) then raise exception 'Connected identities were not synchronized';end if;
 select catalogs->'aircraft'->0->>'prefix' into prefix from public.shared_app_state where id='main';
 if prefix is null then raise exception 'Aircraft test catalog unavailable';end if;
 perform set_config('request.jwt.claim.sub',member_id::text,true);execute 'set local role authenticated';
 result:=public.update_aircraft_management(prefix,target_base,null,null);
 if not exists(select 1 from jsonb_array_elements(result->'aircraft') a where a->>'prefix'=prefix and a->>'base'=target_base) then raise exception 'Coordination lost aircraft base management';end if;
 begin
  perform public.update_aircraft_management(prefix,null,true,null);
  raise exception 'Coordination improperly changed technical availability';
 exception when raise_exception then if sqlerrm<>'Seu perfil só pode alterar a base' then raise;end if;end;
 execute 'reset role';
 if exists(select 1 from public.device_identities where employee_number=employee and assigned_base is distinct from 'Macaé') then raise exception 'Aircraft transfer changed operator base';end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);execute 'set local role authenticated';
 perform public.set_user_access_context(employee,'mechanic',target_base,array['S92']);
 perform public.update_user_operational_assignment(employee,target_base,array['S92'],'mission_1','day');
 execute 'reset role';
 if not exists(select 1 from public.authorized_users where employee_number=employee and fleets=array['S92'] and mission='mission_1' and work_shift='day') then raise exception 'Mechanic assignment regression';end if;
 perform set_config('request.jwt.claim.sub',member_id::text,true);execute 'set local role authenticated';
 begin
  perform public.update_user_operational_assignment(employee,'Macaé','{}',null,null);
  raise exception 'Mechanic changed an operational assignment without permission';
 exception when raise_exception then if sqlerrm<>'Sem permissão para alterar designações operacionais' then raise;end if;end;
 execute 'reset role';
 if has_function_privilege('anon','public.update_user_operational_assignment(text,text,text[],text,text)','execute') then raise exception 'Anonymous access granted';end if;
end $$;
rollback;
