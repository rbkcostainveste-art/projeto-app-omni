alter table public.device_identities
  add column if not exists device_key text;

create unique index if not exists device_identities_employee_device_key_idx
  on public.device_identities(employee_number,device_key)
  where device_key is not null;

with ranked as (
  select auth_user_id,
         row_number() over (
           partition by employee_number,coalesce(device_label,'Dispositivo'),coalesce(user_agent,'')
           order by last_seen_at desc,claimed_at desc
         ) as position
    from public.device_identities
)
delete from public.device_identities d
 using ranked r
 where d.auth_user_id=r.auth_user_id
   and r.position>1;

drop function if exists public.activate_current_device(text,text);

create or replace function public.activate_current_device(
  p_device_key text,
  p_device_label text,
  p_user_agent text
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid();
  v_identity public.device_identities;
  v_key text:=left(trim(coalesce(p_device_key,'')),120);
  v_label text:=left(coalesce(nullif(trim(p_device_label),''),'Dispositivo'),120);
  v_agent text:=left(coalesce(p_user_agent,''),500);
begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  if length(v_key)<16 then raise exception 'Identificador do aparelho inválido'; end if;

  select * into v_identity
    from public.device_identities
   where auth_user_id=v_uid;
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_identity.employee_number||':'||v_key,0));

  delete from public.device_identities d
   where d.employee_number=v_identity.employee_number
     and d.auth_user_id<>v_uid
     and (
       d.device_key=v_key
       or (d.device_key is null and coalesce(d.device_label,'')=v_label and coalesce(d.user_agent,'')=v_agent)
     );

  update public.device_identities
     set device_key=v_key,
         device_label=v_label,
         user_agent=v_agent,
         last_seen_at=now()
   where auth_user_id=v_uid;
end $$;

revoke all on function public.activate_current_device(text,text,text) from public,anon;
grant execute on function public.activate_current_device(text,text,text) to authenticated;
