alter table public.toolboxes add column if not exists base text;
update public.toolboxes b set base=coalesce((select u.assigned_base from public.authorized_users u where u.employee_number=b.created_by),'Não definida') where b.base is null;
alter table public.toolboxes alter column base set not null;
create unique index if not exists toolboxes_base_name_idx on public.toolboxes(lower(base),lower(name));

create table public.toolbox_box_history (
  id uuid primary key default gen_random_uuid(), box_id uuid not null references public.toolboxes(id) on delete cascade,
  event_type text not null check(event_type in ('created','base_changed')), old_base text, new_base text not null,
  employee_number text not null references public.authorized_users(employee_number), created_at timestamptz not null default now()
);
alter table public.toolbox_box_history enable row level security;
revoke all on public.toolbox_box_history from anon,authenticated;

create or replace function public.guard_toolbox_catalog_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy') then raise exception 'Somente o ADM cadastra caixas'; end if;
 if nullif(trim(new.name),'') is null or nullif(trim(new.base),'') is null then raise exception 'Informe o nome e a base da caixa'; end if;
 new.name:=trim(new.name); new.base:=trim(new.base); new.code:=coalesce(nullif(trim(new.code),''),upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
 return new;
end $$;
drop trigger if exists guard_toolbox_catalog_insert on public.toolboxes;
create trigger guard_toolbox_catalog_insert before insert on public.toolboxes for each row execute function public.guard_toolbox_catalog_insert();

create or replace function public.create_toolbox_catalog(p_name text,p_base text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text; v_id uuid;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy') then raise exception 'Somente o ADM cadastra caixas'; end if;
 insert into public.toolboxes(code,name,base,created_by) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),trim(p_name),trim(p_base),v_identity.employee_number) returning id into v_id;
 insert into public.toolbox_box_history(box_id,event_type,new_base,employee_number) values(v_id,'created',trim(p_base),v_identity.employee_number);
 return v_id;
end $$;

create or replace function public.move_toolbox_base(p_box_id uuid,p_base text)
returns void language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text; v_box public.toolboxes;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','toolroom','maintenance_coordinator') then raise exception 'Sem permissão para mudar a base da caixa'; end if;
 select * into v_box from public.toolboxes where id=p_box_id for update;
 if v_box.id is null then raise exception 'Caixa não encontrada'; end if;
 if v_box.status<>'available' then raise exception 'A caixa precisa estar disponível para mudar de base'; end if;
 if nullif(trim(p_base),'') is null then raise exception 'Informe a nova base'; end if;
 if v_box.base=trim(p_base) then return; end if;
 update public.toolboxes set base=trim(p_base),updated_at=now() where id=v_box.id;
 insert into public.toolbox_box_history(box_id,event_type,old_base,new_base,employee_number) values(v_box.id,'base_changed',v_box.base,trim(p_base),v_identity.employee_number);
end $$;

create or replace function public.list_toolbox_catalog()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','toolroom','maintenance_coordinator') then raise exception 'Sem acesso à gestão de Ferramentaria'; end if;
 return jsonb_build_object(
  'boxes',coalesce((select jsonb_agg(to_jsonb(b) order by b.base,b.name) from public.toolboxes b),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.toolbox_box_history h),'[]'::jsonb)
 );
end $$;

revoke all on function public.guard_toolbox_catalog_insert(),public.create_toolbox_catalog(text,text),public.move_toolbox_base(uuid,text),public.list_toolbox_catalog() from public,anon;
grant execute on function public.create_toolbox_catalog(text,text),public.move_toolbox_base(uuid,text),public.list_toolbox_catalog() to authenticated;
