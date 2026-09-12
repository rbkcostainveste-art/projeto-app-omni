begin;

create table if not exists private.admin_content_deletion_audit (
  id bigint generated always as identity primary key,
  employee_number text not null,
  kind text not null,
  item_key jsonb not null,
  snapshot jsonb not null,
  deleted_at timestamptz not null default clock_timestamp()
);
alter table private.admin_content_deletion_audit enable row level security;
revoke all on private.admin_content_deletion_audit from public,anon,authenticated;

create or replace function private.content_kinds()
returns table(kind text,label text,keys text[])
language sql immutable set search_path=''
as $$ values
 ('shared_flights','Voos e giros',array['id']),('shared_passages','Passagens legadas',array['id']),
 ('maintenance_records','Panes, relatos e passagens de serviço',array['id']),
 ('maintenance_entries','Comentários e registros internos da manutenção',array['record_id','entry_id']),
 ('operational_wall_posts','Mural, atividades e Ao vivo',array['id']),
 ('wall_comments','Comentários do mural e atividades',array['post_id','comment_id']),
 ('internal_conversations','Conversas e grupos',array['id']),('internal_messages','Mensagens, áudios e mídias do chat',array['id']),
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
 ('technical_case_audit','Histórico técnico',array['id']),('cockpit_audit','Histórico do cockpit',array['id']);
$$;
revoke all on function private.content_kinds() from public,anon,authenticated;

create or replace function public.admin_content(
  p_action text,
  p_kind text default '',
  p_keys jsonb default '[]',
  p_confirmation text default '',
  p_offset integer default 0
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  actor_employee text;
  k record;
  item jsonb;
  row_data jsonb;
  rows jsonb;
  total bigint;
  counts jsonb:='[]';
  removed integer:=0;
  source text;
  column_name text;
  fid text;
  old_rows jsonb;
begin
  if not private.content_admin() then raise exception 'Somente o ADM pode excluir conteúdo';end if;
  select d.employee_number into actor_employee
  from public.device_identities d where d.auth_user_id=auth.uid();

  if p_action='catalog' then
    for k in select * from private.content_kinds() loop
      if k.kind like 'shared_%' then
        column_name:=case k.kind when 'shared_flights' then 'flights' else 'passages' end;
        execute format('select coalesce(jsonb_array_length(%I),0) from public.shared_app_state where id=''main''',column_name) into total;
      elsif k.kind='wall_comments' then
        select coalesce(sum(jsonb_array_length(coalesce(data->'comments','[]'::jsonb))),0) into total from public.operational_wall_posts;
      elsif k.kind='maintenance_entries' then
        select coalesce(sum(jsonb_array_length(coalesce(data->'entries','[]'::jsonb))),0) into total from public.maintenance_records;
      else
        execute format('select count(*) from public.%I',k.kind) into total;
      end if;
      counts:=counts||jsonb_build_array(jsonb_build_object('kind',k.kind,'label',k.label,'count',coalesce(total,0)));
    end loop;
    return counts||jsonb_build_array(jsonb_build_object('kind','files','label','Anexos, imagens, áudios e vídeos','count',(select count(*) from storage.objects)));
  end if;

  if p_action='pending_files' then
    return coalesce((select jsonb_agg(to_jsonb(q)) from private.content_file_deletions q),'[]');
  end if;
  if p_action='file_done' then
    for item in select value from jsonb_array_elements(p_keys) loop
      delete from private.content_file_deletions
      where bucket=item->>'bucket' and name=item->>'name'
        and not exists(select 1 from storage.objects where bucket_id=item->>'bucket' and name=item->>'name');
    end loop;
    return 'true';
  end if;

  if p_kind='files' then
    if p_action='list' then
      return jsonb_build_object('rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'key',jsonb_build_object('bucket',bucket_id,'name',name),
          'label',bucket_id||' / '||name,
          'date',created_at
        ) order by created_at desc)
        from (select * from storage.objects order by created_at desc limit 100 offset greatest(p_offset,0)) o
      ),'[]'));
    elsif p_action='delete' and p_confirmation='EXCLUIR' then
      for item in select value from jsonb_array_elements(p_keys) loop
        select to_jsonb(o) into row_data from storage.objects o
        where o.bucket_id=item->>'bucket' and o.name=item->>'name';
        if row_data is null then continue;end if;
        insert into private.admin_content_deletion_audit(employee_number,kind,item_key,snapshot)
        values(actor_employee,'files',item,row_data);
        insert into private.content_file_deletions
        select bucket_id,name from storage.objects where bucket_id=item->>'bucket' and name=item->>'name'
        on conflict do nothing;
        removed:=removed+1;
      end loop;
      return jsonb_build_object('removed',removed);
    end if;
  end if;

  select * into k from private.content_kinds() where kind=p_kind;
  if not found then raise exception 'Tipo de conteúdo inválido';end if;

  if p_action='list' and k.kind='wall_comments' then
    select coalesce(jsonb_agg(data order by sort_at desc),'[]') into rows from (
      select comment->>'at' as sort_at,jsonb_build_object(
        'key',jsonb_build_object('post_id',post.id,'comment_id',comment->>'id'),
        'label',coalesce(nullif(comment->>'body',''),'Comentário com anexo')||' · Mat. '||coalesce(comment->>'employeeNumber',''),
        'date',comment->>'at'
      ) data
      from public.operational_wall_posts post
      cross join lateral jsonb_array_elements(coalesce(post.data->'comments','[]'::jsonb)) comment
      where nullif(comment->>'id','') is not null
      order by comment->>'at' desc limit 100 offset greatest(p_offset,0)
    ) page;
    return jsonb_build_object('rows',rows);
  end if;

  if p_action='list' and k.kind='maintenance_entries' then
    select coalesce(jsonb_agg(data order by sort_at desc),'[]') into rows from (
      select entry->>'at' as sort_at,jsonb_build_object(
        'key',jsonb_build_object('record_id',record.id,'entry_id',entry->>'id'),
        'label',record.prefix||' · '||coalesce(nullif(entry->>'description',''),coalesce(entry->>'kind','Registro interno')),
        'date',entry->>'at'
      ) data
      from public.maintenance_records record
      cross join lateral jsonb_array_elements(coalesce(record.data->'entries','[]'::jsonb)) entry
      where nullif(entry->>'id','') is not null
      order by entry->>'at' desc limit 100 offset greatest(p_offset,0)
    ) page;
    return jsonb_build_object('rows',rows);
  end if;

  if k.kind like 'shared_%' then
    column_name:=case k.kind when 'shared_flights' then 'flights' else 'passages' end;
    source:=format('(select value as data from public.shared_app_state s,jsonb_array_elements(s.%I) where s.id=''main'') src',column_name);
  elsif k.kind not in ('wall_comments','maintenance_entries') then
    source:=format('(select to_jsonb(t) as data from public.%I t) src',k.kind);
  end if;

  if p_action='list' then
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''key'',(select jsonb_object_agg(key,value) from jsonb_each(data) where key=any($1)),''label'',coalesce(data->>''title'',data#>>''{data,title}'',data->>''body'',data->>''name'',data->>''prefix'',data->>''employee_number'',data->>''flight_id'',data->>''id'',''Registro''),''date'',coalesce(data->>''created_at'',data#>>''{data,createdAt}'',data->>''date'',data->>''at'','''')) order by coalesce(data->>''created_at'',data#>>''{data,createdAt}'',data->>''date'',data->>''at'','''') desc),''[]'') from (select data from %s order by coalesce(data->>''created_at'',data#>>''{data,createdAt}'',data->>''date'',data->>''at'','''') desc,data->>''id'' desc limit 100 offset $2) page',
      source
    ) into rows using k.keys,greatest(p_offset,0);
    return jsonb_build_object('rows',rows);
  end if;

  if p_action<>'delete' or p_confirmation<>'EXCLUIR' or jsonb_typeof(p_keys)<>'array' or jsonb_array_length(p_keys)>100 then
    raise exception 'Confirme os itens que deseja excluir';
  end if;

  for item in select value from jsonb_array_elements(p_keys) loop
    if jsonb_typeof(item)<>'object' or not item ?& k.keys or (select count(*) from jsonb_object_keys(item))<>cardinality(k.keys) then
      raise exception 'Identificador inválido';
    end if;

    if k.kind='wall_comments' then
      select comment into row_data
      from public.operational_wall_posts post
      cross join lateral jsonb_array_elements(coalesce(post.data->'comments','[]'::jsonb)) comment
      where post.id=item->>'post_id' and comment->>'id'=item->>'comment_id' for update of post;
      if row_data is null then continue;end if;
      perform private.queue_content_files(row_data);
      insert into private.admin_content_deletion_audit(employee_number,kind,item_key,snapshot)
      values(actor_employee,k.kind,item,row_data);
      update public.operational_wall_posts
      set data=(case when data->>'pinnedCommentId'=item->>'comment_id' then data-'pinnedCommentId' else data end)
        ||jsonb_build_object('comments',(select coalesce(jsonb_agg(comment),'[]'::jsonb) from jsonb_array_elements(coalesce(data->'comments','[]'::jsonb)) comment where comment->>'id'<>item->>'comment_id'),
          'updatedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
          revision=revision+1,updated_at=clock_timestamp()
      where id=item->>'post_id';
    elsif k.kind='maintenance_entries' then
      select entry into row_data
      from public.maintenance_records record
      cross join lateral jsonb_array_elements(coalesce(record.data->'entries','[]'::jsonb)) entry
      where record.id=(item->>'record_id')::uuid and entry->>'id'=item->>'entry_id' for update of record;
      if row_data is null then continue;end if;
      perform private.queue_content_files(row_data);
      insert into private.admin_content_deletion_audit(employee_number,kind,item_key,snapshot)
      values(actor_employee,k.kind,item,row_data);
      update public.maintenance_records
      set data=(case when data->>'pinnedCommentId'=item->>'entry_id' then data-'pinnedCommentId' else data end)
        ||jsonb_build_object('entries',(select coalesce(jsonb_agg(entry),'[]'::jsonb) from jsonb_array_elements(coalesce(data->'entries','[]'::jsonb)) entry where entry->>'id'<>item->>'entry_id'),
          'updatedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
          revision=revision+1,updated_at=clock_timestamp()
      where id=(item->>'record_id')::uuid;
    elsif k.kind like 'shared_%' then
      execute format('select %I from public.shared_app_state where id=''main'' for update',column_name) into old_rows;
      select value into row_data from jsonb_array_elements(old_rows) where value @> item;
      if row_data is null then continue;end if;
      perform private.queue_content_files(row_data);
      insert into private.admin_content_deletion_audit(employee_number,kind,item_key,snapshot)
      values(actor_employee,k.kind,item,row_data);
      execute format('update public.shared_app_state set %I=(select coalesce(jsonb_agg(value),''[]'') from jsonb_array_elements(%I) where not value @> $1),revision=revision+1,updated_at=now() where id=''main''',column_name,column_name) using item;
      fid:=item->>'id';
      if k.kind='shared_flights' then
        delete from public.flight_operation_records where flight_id=fid;
        delete from public.flight_position_confirmations where flight_id=fid;
        delete from public.flight_alerts where flight_id=fid;
        delete from public.crew_checkins where flight_id=fid;
        delete from public.coordination_technical_alerts where flight_id=fid;
        delete from public.cockpit_entries where flight_id=fid;
      else
        delete from public.runway_handovers where id::text=fid;
      end if;
    else
      execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',k.kind) into row_data using item;
      if row_data is null then continue;end if;
      insert into private.admin_content_deletion_audit(employee_number,kind,item_key,snapshot)
      values(actor_employee,k.kind,item,row_data);
      execute format('delete from public.%I t where to_jsonb(t) @> $1',k.kind) using item;
      if k.kind='maintenance_records' then
        delete from public.operational_wall_posts where data->>'maintenanceRecordId'=item->>'id';
        delete from public.technical_case_audit where record_id::text=item->>'id';
      end if;
    end if;
    removed:=removed+1;
  end loop;
  return jsonb_build_object('removed',removed);
end
$$;

revoke all on function public.admin_content(text,text,jsonb,text,integer) from public,anon;
grant execute on function public.admin_content(text,text,jsonb,text,integer) to authenticated;

commit;
