begin;
do $$
declare row_post public.operational_wall_posts; actor record; blocked boolean; allowed boolean;
begin
 select * into row_post from public.operational_wall_posts where nullif(data->>'maintenanceRecordId','') is not null limit 1;
 if row_post.id is null then raise exception 'Fixture de publicação vinculada ausente';end if;
 for actor in select distinct on(u.job_role) d.auth_user_id,u.job_role from public.device_identities d join public.authorized_users u using(employee_number) where u.active and u.job_role in('mechanic','maintenance_inspector','maintenance_coordinator','admin') loop
  perform set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  blocked:=false;
  begin perform public.delete_own_operational_wall_post(row_post.id);exception when others then blocked:=true;end;
  if not blocked then raise exception 'RPC permitiu exclusão para %',actor.job_role;end if;
  blocked:=false;
  begin delete from public.operational_wall_posts where id=row_post.id;exception when others then blocked:=true;end;
  if not blocked then raise exception 'Exclusão direta permitida para %',actor.job_role;end if;
  blocked:=false;
  begin update public.operational_wall_posts set data=data-'maintenanceRecordId' where id=row_post.id;exception when others then blocked:=true;end;
  if not blocked then raise exception 'Vínculo removível para %',actor.job_role;end if;
  allowed:=private.technical_allowed('close');
  if actor.job_role='mechanic' and coalesce(allowed,false) then raise exception 'Mecânico pode encerrar';end if;
  if actor.job_role in('maintenance_inspector','maintenance_coordinator') and not coalesce(allowed,false) then raise exception 'Inspetoria/coordenação sem encerramento';end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;
 begin perform public.delete_own_operational_wall_post(row_post.id);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Sessão ausente permitida';end if;
end $$;
select 'PASS: exclusão RPC/direta bloqueada, origem imutável, encerramento por perfil e sessão ausente' result;
rollback;
