create function private.content_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and (d.is_admin or u.access_profile='admin' or u.job_role='admin'));
$$;
revoke all on function private.content_admin() from public,anon;
grant execute on function private.content_admin() to authenticated;
create function private.content_kinds() returns table(kind text,label text,keys text[]) language sql immutable set search_path='' as $$ values
 ('shared_flights','Voos e giros',array['id']),('shared_passages','Passagens legadas',array['id']),
 ('maintenance_records','Panes, relatos e programadas',array['id']),('operational_wall_posts','Mural e atividades',array['id']),
 ('internal_conversations','Conversas e grupos',array['id']),('internal_messages','Mensagens do chat',array['id']),
 ('chat_calls','Chamadas',array['id']),('runway_handovers','Passagens de pista',array['id']),
 ('compressor_drying_tasks','Secagens',array['id']),('runway_wash_events','Lavagens',array['id']),
 ('personal_assistant_conversations','Conversas com a IA',array['id']),('personal_assistant_history','Mensagens da IA',array['id']),
 ('personal_notes','Notas e lembretes',array['id']),('cockpit_entries','Registros do cockpit',array['id']),
 ('help_videos','Vídeos de ajuda',array['id']),('toolboxes','Caixas de ferramentas',array['id']),
 ('toolbox_operations','Movimentações de ferramentas',array['id']),('toolbox_events','Eventos de ferramentas',array['id']),
 ('toolbox_visual_catalog','Catálogos visuais de caixas',array['box_id']),('toolbox_identification_drafts','Identificações de ferramentas',array['id']),
 ('toolbox_box_history','Histórico das caixas',array['id']),('toolbox_audit','Histórico de ferramentas',array['id']),
 ('flight_operation_records','Execuções e checklist dos voos',array['flight_id']),('flight_position_confirmations','Posições dos voos',array['flight_id']),
 ('flights','Voos legados',array['id']),('flight_alerts','Alertas de voo',array['auth_user_id','flight_id']),
 ('crew_checkins','Apresentações da tripulação',array['employee_number','flight_date']),
 ('coordination_technical_alerts','Alertas da coordenação',array['id']),('technical_case_alerts','Alertas técnicos',array['id']),
 ('technical_case_audit','Histórico técnico',array['id']),('cockpit_audit','Histórico do cockpit',array['id']); $$;
revoke all on function private.content_kinds() from public,anon,authenticated;

-- Children owned by content are removed with their parent, including closed chats.
do $$ declare c record; definition text; begin
 for c in select oid,conrelid::regclass as child,conname from pg_constraint where contype='f' and connamespace='public'::regnamespace and confrelid in('public.internal_conversations'::regclass,'public.internal_messages'::regclass,'public.chat_calls'::regclass,'public.maintenance_records'::regclass,'public.cockpit_entries'::regclass,'public.personal_assistant_conversations'::regclass,'public.toolboxes'::regclass,'public.toolbox_events'::regclass) and confdeltype<>'c' loop
  definition:=regexp_replace(pg_get_constraintdef(c.oid),' ON DELETE (RESTRICT|NO ACTION|SET NULL|SET DEFAULT)','');
  execute format('alter table %s drop constraint %I',c.child,c.conname);
  execute format('alter table %s add constraint %I %s ON DELETE CASCADE',c.child,c.conname,definition);
 end loop;
end $$;
do $$ declare definition text; begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into definition;
 definition:=replace(definition,$patch$if tg_op='DELETE' then raise exception$patch$,$patch$if tg_op='DELETE' and private.content_admin() then return old;end if; if tg_op='DELETE' then raise exception$patch$);
 execute definition;
 select pg_get_functiondef('private.guard_wall_origin_deletion()'::regprocedure) into definition;
 definition:=replace(definition,'begin',$patch$begin
 if tg_op='DELETE' and private.content_admin() then return old;end if;$patch$);
 execute definition;
end $$;
create table private.content_file_deletions(bucket text not null,name text not null,primary key(bucket,name));
alter table private.content_file_deletions enable row level security;
revoke all on private.content_file_deletions from public,anon,authenticated;
create function private.queue_content_files(p_data jsonb) returns void language sql security definer set search_path='' as $$
 insert into private.content_file_deletions select bucket_id,name from storage.objects where strpos(p_data::text,name)>0 on conflict do nothing;
$$;
revoke all on function private.queue_content_files(jsonb) from public,anon,authenticated;
create function private.deleted_content_files() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if private.content_admin() then perform private.queue_content_files(to_jsonb(old));end if;return old;
end $$;
revoke all on function private.deleted_content_files() from public,anon,authenticated;
do $$ declare k record;begin
 for k in select * from private.content_kinds() where kind not like 'shared_%' loop
 execute format('create trigger admin_deleted_content_files after delete on public.%I for each row execute function private.deleted_content_files()',k.kind);
 end loop;
end $$;
create policy "admin can remove content files" on storage.objects for delete to authenticated using(private.content_admin());
create policy "admin can list content files" on storage.objects for select to authenticated using(private.content_admin());

create function public.admin_content(p_action text,p_kind text default '',p_keys jsonb default '[]',p_confirmation text default '',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare k record; item jsonb; row_data jsonb; rows jsonb; total bigint; counts jsonb:='[]'; removed integer:=0; source text; column_name text; fid text; old_rows jsonb;
begin
 if not private.content_admin() then raise exception 'Somente o ADM pode excluir conteúdo';end if;
 if p_action='catalog' then
  for k in select * from private.content_kinds() loop
   if k.kind like 'shared_%' then column_name:=case k.kind when 'shared_flights' then 'flights' else 'passages' end;execute format('select coalesce(jsonb_array_length(%I),0) from public.shared_app_state where id=''main''',column_name) into total;
   else execute format('select count(*) from public.%I',k.kind) into total;end if;
   counts:=counts||jsonb_build_array(jsonb_build_object('kind',k.kind,'label',k.label,'count',coalesce(total,0)));
  end loop;
  return counts||jsonb_build_array(jsonb_build_object('kind','files','label','Anexos, imagens, áudios e vídeos','count',(select count(*) from storage.objects)));
 end if;
 if p_action='pending_files' then return coalesce((select jsonb_agg(to_jsonb(q)) from private.content_file_deletions q),'[]');end if;
 if p_action='file_done' then
  for item in select value from jsonb_array_elements(p_keys) loop
   delete from private.content_file_deletions where bucket=item->>'bucket' and name=item->>'name' and not exists(select 1 from storage.objects where bucket_id=item->>'bucket' and name=item->>'name');
  end loop;return 'true';
 end if;
 if p_kind='files' then
  if p_action='list' then return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('key',jsonb_build_object('bucket',bucket_id,'name',name),'label',bucket_id||' / '||name)) from (select * from storage.objects order by bucket_id,name limit 100 offset greatest(p_offset,0)) o),'[]'));
  elsif p_action='delete' and p_confirmation='EXCLUIR' then
   for item in select value from jsonb_array_elements(p_keys) loop insert into private.content_file_deletions select bucket_id,name from storage.objects where bucket_id=item->>'bucket' and name=item->>'name' on conflict do nothing;end loop;
   return jsonb_build_object('removed',0);
  end if;
 end if;
 select * into k from private.content_kinds() where kind=p_kind;if not found then raise exception 'Tipo de conteúdo inválido';end if;
 if k.kind like 'shared_%' then
  column_name:=case k.kind when 'shared_flights' then 'flights' else 'passages' end;
  source:=format('(select value as data from public.shared_app_state s,jsonb_array_elements(s.%I) where s.id=''main'') src',column_name);
 else source:=format('(select to_jsonb(t) as data from public.%I t) src',k.kind);end if;
 if p_action='list' then
  execute format('select coalesce(jsonb_agg(jsonb_build_object(''key'',(select jsonb_object_agg(key,value) from jsonb_each(data) where key=any($1)),''label'',coalesce(data->>''title'',data#>>''{data,title}'',data->>''name'',data->>''prefix'',data->>''employee_number'',data->>''flight_id'',data->>''id'',''Registro''),''date'',coalesce(data->>''created_at'',data->>''date'',data->>''at'',''''))),''[]'') from (select data from %s order by data->>''id'',data::text limit 100 offset $2) page',source) into rows using k.keys,greatest(p_offset,0);
  return jsonb_build_object('rows',rows);
 end if;
 if p_action<>'delete' or p_confirmation<>'EXCLUIR' or jsonb_typeof(p_keys)<>'array' or jsonb_array_length(p_keys)>100 then raise exception 'Confirme os itens que deseja excluir';end if;
 for item in select value from jsonb_array_elements(p_keys) loop
  if jsonb_typeof(item)<>'object' or not item ?& k.keys or (select count(*) from jsonb_object_keys(item))<>cardinality(k.keys) then raise exception 'Identificador inválido';end if;
  if k.kind like 'shared_%' then
   execute format('select %I from public.shared_app_state where id=''main'' for update',column_name) into old_rows;
   select value into row_data from jsonb_array_elements(old_rows) where value @> item;
   if row_data is null then continue;end if;
   perform private.queue_content_files(row_data);
   execute format('update public.shared_app_state set %I=(select coalesce(jsonb_agg(value),''[]'') from jsonb_array_elements(%I) where not value @> $1),revision=revision+1,updated_at=now() where id=''main''',column_name,column_name) using item;
   fid:=item->>'id';
   if k.kind='shared_flights' then
    delete from public.flight_operation_records where flight_id=fid;
    delete from public.flight_position_confirmations where flight_id=fid;
    delete from public.flight_alerts where flight_id=fid;
    delete from public.crew_checkins where flight_id=fid;
    delete from public.coordination_technical_alerts where flight_id=fid;
    delete from public.cockpit_entries where flight_id=fid;
   else delete from public.runway_handovers where id::text=fid;end if;
  else
   execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',k.kind) into row_data using item;
   if row_data is null then continue;end if;
   execute format('delete from public.%I t where to_jsonb(t) @> $1',k.kind) using item;
   if k.kind='maintenance_records' then
    delete from public.operational_wall_posts where data->>'maintenanceRecordId'=item->>'id';
    delete from public.technical_case_audit where record_id::text=item->>'id';
   end if;
  end if;
  removed:=removed+1;
 end loop;
 return jsonb_build_object('removed',removed);
end $$;
revoke all on function public.admin_content(text,text,jsonb,text,integer) from public,anon;
grant execute on function public.admin_content(text,text,jsonb,text,integer) to authenticated;
