-- Visual catalog stays private; all reads and writes pass through signed RPCs.
create table public.toolbox_visual_catalog (
 box_id uuid primary key references public.toolboxes(id),
 drawers jsonb not null default '[]', revision integer not null default 0,
 updated_by text not null, updated_at timestamptz not null default now()
);
alter table public.toolbox_visual_catalog enable row level security;
revoke all on public.toolbox_visual_catalog from public,anon,authenticated;
alter table public.toolboxes add column transfer_to text, add column transfer_by text, add column transfer_at timestamptz;
alter table public.toolbox_events add column tool_refs jsonb not null default '[]';

create function public.toolbox_manager_identity() returns text language plpgsql security definer set search_path='' as $$
declare d public.device_identities;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 if d.auth_user_id is null or coalesce(d.job_role,d.access_profile) not in('admin','app_manager','legacy','toolroom','maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director') then raise exception 'Sem permissão para gerir caixas';end if;
 return d.employee_number;
end $$;

create function public.get_toolbox_visual(p_box_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.device_identities;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 if d.auth_user_id is null or coalesce(d.job_role,d.access_profile) not in('admin','app_manager','legacy','toolroom','mechanic','maintenance_assistant','maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director') then raise exception 'Sem acesso';end if;
 return jsonb_build_object('catalog',coalesce((select to_jsonb(c) from public.toolbox_visual_catalog c where box_id=p_box_id),jsonb_build_object('drawers','[]'::jsonb,'revision',0)),
 'loans',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'employee',e.employee_number,'tools',e.tool_refs)) from public.toolbox_events e join public.toolbox_operations o on o.id=e.operation_id where o.box_id=p_box_id and e.status not in('confirmed','cancelled')),'[]'::jsonb));
end $$;

create function public.save_toolbox_visual(p_box_id uuid,p_drawers jsonb,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare actor text; d jsonb; t jsonb; ids text[]:='{}'; old_revision integer;
begin
 actor:=public.toolbox_manager_identity();
 perform 1 from public.toolboxes where id=p_box_id for update;
 if not found then raise exception 'Caixa não encontrada';end if;
 if exists(select 1 from public.toolboxes where id=p_box_id and (status<>'available' or transfer_to is not null)) then raise exception 'Conclua os empréstimos e devolva a caixa antes de editar o catálogo';end if;
 select revision into old_revision from public.toolbox_visual_catalog where box_id=p_box_id;
 if coalesce(old_revision,0)<>p_revision then raise exception 'Catálogo alterado por outra pessoa. Reabra antes de editar';end if;
 if jsonb_typeof(p_drawers)<>'array' or jsonb_array_length(p_drawers)>30 or octet_length(p_drawers::text)>20000000 then raise exception 'Catálogo inválido ou muito grande';end if;
 for d in select value from jsonb_array_elements(p_drawers) loop
  if nullif(trim(d->>'name'),'') is null or jsonb_typeof(d->'tools')<>'array' or jsonb_array_length(d->'tools')>200 then raise exception 'Confira nome e ferramentas da gaveta';end if;
  for t in select value from jsonb_array_elements(d->'tools') loop
   if nullif(t->>'id','') is null or (t->>'id')=any(ids) or nullif(trim(t->>'name'),'') is null or (t->>'x')::numeric not between 0 and 100 or (t->>'y')::numeric not between 0 and 100 then raise exception 'Confira identificações e posições das ferramentas';end if;
   if coalesce((d->>'reviewed')::boolean,false) and not coalesce((t->>'reviewed')::boolean,false) then raise exception 'Confira cada ferramenta antes de liberar a gaveta';end if;
   ids:=array_append(ids,t->>'id');
  end loop;
 end loop;
 insert into public.toolbox_visual_catalog(box_id,drawers,revision,updated_by) values(p_box_id,p_drawers,1,actor) on conflict(box_id) do update set drawers=excluded.drawers,revision=public.toolbox_visual_catalog.revision+1,updated_by=actor,updated_at=now();
 insert into public.toolbox_audit(action,target_id,actor,payload) values('save_visual_catalog',p_box_id,actor,jsonb_build_object('revision',coalesce(old_revision,0)+1,'drawers',(select jsonb_agg(value-'photo') from jsonb_array_elements(p_drawers))));
end $$;

create or replace function public.move_toolbox_base(p_box_id uuid,p_base text) returns void language plpgsql security definer set search_path='' as $$
declare actor text; b public.toolboxes;
begin
 actor:=public.toolbox_manager_identity();
 select * into b from public.toolboxes where id=p_box_id for update;
 if b.id is null or b.status<>'available' or b.transfer_to is not null then raise exception 'Caixa indisponível para transferência';end if;
 if nullif(trim(p_base),'') is null or p_base=b.base then raise exception 'Selecione outra base';end if;
 if not exists(select 1 from public.operation_bases where name=p_base) then raise exception 'Base não cadastrada';end if;
 update public.toolboxes set transfer_to=p_base,transfer_by=actor,transfer_at=now(),updated_at=now() where id=p_box_id;
 insert into public.toolbox_audit(action,target_id,actor,payload) values('release_transfer',p_box_id,actor,jsonb_build_object('from',b.base,'to',p_base));
end $$;
create function public.receive_toolbox_transfer(p_box_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor text; b public.toolboxes;
begin
 actor:=public.toolbox_manager_identity();select * into b from public.toolboxes where id=p_box_id for update;
 if b.transfer_to is null then raise exception 'Não há transferência pendente';end if;
 update public.toolboxes set base=b.transfer_to,transfer_to=null,transfer_by=null,transfer_at=null,updated_at=now() where id=p_box_id;
 insert into public.toolbox_box_history(box_id,event_type,old_base,new_base,employee_number) values(p_box_id,'base_changed',b.base,b.transfer_to,actor);
 insert into public.toolbox_audit(action,target_id,actor,payload) values('receive_transfer',p_box_id,actor,jsonb_build_object('from',b.base,'to',b.transfer_to));
end $$;

alter function public.toolbox_command(text,jsonb) rename to toolbox_command_legacy;
revoke all on function public.toolbox_command_legacy(text,jsonb) from public,anon,authenticated;
create function public.toolbox_command(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.toolbox_operations; ev public.toolbox_events; actor text; selected jsonb; snapshot jsonb:='[]'; tool jsonb; drawer jsonb; ident text; result jsonb; names text:=''; b uuid;
begin
 select employee_number into actor from public.device_identities where auth_user_id=auth.uid();if actor is null then raise exception 'Sem acesso';end if;
 if p_action='assign_box' then
  perform 1 from public.toolboxes where id=(p_payload->>'boxId')::uuid for update;
  if exists(select 1 from public.toolboxes where id=(p_payload->>'boxId')::uuid and transfer_to is not null) then raise exception 'Caixa em transferência';end if;
 end if;
 if p_action in('take_tool','correct_tool_selection') then
  if p_action='correct_tool_selection' then
   select * into ev from public.toolbox_events where id=(p_payload->>'eventId')::uuid;
   if ev.id is null or ev.employee_number<>actor or ev.status not in('awaiting_approval','open') then raise exception 'Esta retirada não permite correção';end if;
   select * into op from public.toolbox_operations where id=ev.operation_id for update;
   select * into ev from public.toolbox_events where id=ev.id for update;
   if ev.status not in('awaiting_approval','open') then raise exception 'Retirada alterada; atualize a tela';end if;
  else
   select * into op from public.toolbox_operations where box_id=(p_payload->>'boxId')::uuid and status='in_use' for update;
  end if;
  if op.id is null or op.return_intent_at is not null then raise exception 'Caixa indisponível';end if;b:=op.box_id;
  selected:=coalesce(p_payload->'toolIds','[]');
  if exists(select 1 from public.toolbox_visual_catalog where box_id=b and jsonb_array_length(drawers)>0) and jsonb_array_length(selected)=0 then raise exception 'Selecione as ferramentas no catálogo da gaveta';end if;
  if jsonb_typeof(selected)<>'array' or jsonb_array_length(selected)>100 then raise exception 'Seleção inválida';end if;
  for ident in select value from jsonb_array_elements_text(selected) loop
   select d.value,t.value into drawer,tool from public.toolbox_visual_catalog c cross join lateral jsonb_array_elements(c.drawers) d cross join lateral jsonb_array_elements(d.value->'tools') t where c.box_id=b and t.value->>'id'=ident and (d.value->>'reviewed')::boolean and (t.value->>'reviewed')::boolean;
   if tool is null then raise exception 'Ferramenta não encontrada ou ainda não conferida';end if;
   if exists(select 1 from jsonb_array_elements(snapshot) s where s->>'id'=ident) then raise exception 'Ferramenta duplicada';end if;
   if exists(select 1 from public.toolbox_events e join public.toolbox_operations o on o.id=e.operation_id cross join lateral jsonb_array_elements(e.tool_refs) r where o.box_id=b and e.status not in('confirmed','cancelled') and e.id is distinct from ev.id and r->>'id'=ident) then raise exception 'Ferramenta já reservada ou emprestada. Atualize a gaveta';end if;
   snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',ident,'name',tool->>'name','measure',tool->>'measure','drawer',drawer->>'name','boxId',b));
   names:=names||case when names='' then '' else E'\n' end||(tool->>'name')||' '||coalesce(tool->>'measure','')||' · '||(drawer->>'name');
  end loop;
  if p_action='correct_tool_selection' then
   if jsonb_array_length(snapshot)=0 or nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Selecione ferramentas e informe o motivo da correção';end if;
   insert into public.toolbox_audit(action,target_id,actor,payload) values('correct_tool_selection',ev.id,actor,jsonb_build_object('before',ev.tool_refs,'after',snapshot,'reason',p_payload->>'reason'));
   update public.toolbox_events set tool_refs=snapshot,description=names,status='awaiting_approval',approved_by=null,approved_at=null where id=ev.id;
   return jsonb_build_object('id',ev.id);
  end if;
  result:=public.toolbox_command_legacy(p_action,case when jsonb_array_length(snapshot)>0 then p_payload||jsonb_build_object('description',names) else p_payload end);
  update public.toolbox_events set tool_refs=snapshot where id=(result->>'id')::uuid;return result;
 end if;
 return public.toolbox_command_legacy(p_action,p_payload);
end $$;

create function public.get_toolbox_audit(p_box_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.get_toolbox_visual(p_box_id);
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.at desc) from public.toolbox_audit a where a.target_id=p_box_id or a.target_id in(select id from public.toolbox_operations where box_id=p_box_id) or a.target_id in(select e.id from public.toolbox_events e join public.toolbox_operations o on o.id=e.operation_id where o.box_id=p_box_id)),'[]');
end $$;
revoke all on function public.toolbox_manager_identity(),public.get_toolbox_visual(uuid),public.save_toolbox_visual(uuid,jsonb,integer),public.receive_toolbox_transfer(uuid),public.toolbox_command(text,jsonb),public.get_toolbox_audit(uuid) from public,anon;
grant execute on function public.toolbox_manager_identity(),public.get_toolbox_visual(uuid),public.save_toolbox_visual(uuid,jsonb,integer),public.receive_toolbox_transfer(uuid),public.toolbox_command(text,jsonb),public.get_toolbox_audit(uuid) to authenticated;

create or replace function public.guard_toolbox_catalog_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','toolroom','maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director') then raise exception 'Somente a gestão da ferramentaria cadastra caixas'; end if;
 if nullif(trim(new.name),'') is null or nullif(trim(new.base),'') is null then raise exception 'Informe o nome e a base da caixa'; end if;
 new.name:=trim(new.name); new.base:=trim(new.base); new.code:=coalesce(nullif(trim(new.code),''),upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
 return new;
end $$;

create or replace function public.create_toolbox_catalog(p_name text,p_base text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text; v_id uuid;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','toolroom','maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director') then raise exception 'Somente a gestão da ferramentaria cadastra caixas'; end if;
 insert into public.toolboxes(code,name,base,created_by) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),trim(p_name),trim(p_base),v_identity.employee_number) returning id into v_id;
 insert into public.toolbox_box_history(box_id,event_type,new_base,employee_number) values(v_id,'created',trim(p_base),v_identity.employee_number);
 return v_id;
end $$;

create or replace function public.list_toolbox_catalog()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_role text;
begin
 select * into v_identity from public.device_identities where auth_user_id=auth.uid(); v_role:=coalesce(v_identity.job_role,v_identity.access_profile);
 if v_identity.auth_user_id is null or v_role not in ('admin','app_manager','legacy','toolroom','maintenance_inspector','maintenance_leader','maintenance_coordinator','maintenance_manager','maintenance_director') then raise exception 'Sem acesso à gestão de Ferramentaria'; end if;
 return jsonb_build_object(
  'boxes',coalesce((select jsonb_agg(to_jsonb(b) order by b.base,b.name) from public.toolboxes b),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.toolbox_box_history h),'[]'::jsonb)
 );
end $$;
