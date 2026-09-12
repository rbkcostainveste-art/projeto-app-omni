-- Exercises real content with a rollback. Does not remove files from Storage.
begin;
select set_config('request.jwt.claim.sub',(select d.auth_user_id::text from public.device_identities d join public.authorized_users u using(employee_number) where not d.is_admin and u.active and u.access_profile<>'admin' limit 1),true);
do $$ begin
 begin perform public.admin_content('catalog');raise exception 'non-admin unexpectedly allowed';
 exception when others then if sqlerrm<>'Somente o ADM pode excluir conteúdo' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select d.auth_user_id::text from public.device_identities d join public.authorized_users u using(employee_number) where d.is_admin and u.active limit 1),true);
do $$ declare k record; entries jsonb; before_boxes jsonb; wall_id text:='admin-content-test-'||gen_random_uuid(); record_id uuid:=gen_random_uuid(); audit_before bigint;begin
 select jsonb_agg(to_jsonb(t) order by id) into before_boxes from public.toolboxes t;
 if not exists(select 1 from private.content_kinds() where kind='wall_comments' and keys=array['post_id','comment_id']) or not exists(select 1 from private.content_kinds() where kind='maintenance_entries' and keys=array['record_id','entry_id']) then raise exception 'granular content kinds missing';end if;
 if has_table_privilege('authenticated','private.admin_content_deletion_audit','select') then raise exception 'deletion audit exposed';end if;
 begin perform public.admin_content('delete','maintenance_records','[{}]','EXCLUIR');raise exception 'empty key unexpectedly allowed';
 exception when others then if sqlerrm<>'Identificador inválido' then raise;end if;end;
 select count(*) into audit_before from private.admin_content_deletion_audit;
 insert into public.operational_wall_posts(id,base,data) values(wall_id,'Teste',jsonb_build_object('id',wall_id,'title','Teste','comments',jsonb_build_array(jsonb_build_object('id','wall-comment','body','Teste','employeeNumber','0001','at',clock_timestamp()))));
 insert into public.maintenance_records(id,record_type,base,model,prefix,title,created_by,ticket_code,data) values(record_id,'inspection','Teste','Teste','PR-TST','Teste','0001','ADM-TEST',jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('id','record-entry','kind','comment','description','Teste','employeeNumber','0001','at',clock_timestamp()))));
 perform public.admin_content('delete','wall_comments',jsonb_build_array(jsonb_build_object('post_id',wall_id,'comment_id','wall-comment')),'EXCLUIR');
 perform public.admin_content('delete','maintenance_entries',jsonb_build_array(jsonb_build_object('record_id',record_id,'entry_id','record-entry')),'EXCLUIR');
 if (select jsonb_array_length(coalesce(data->'comments','[]')) from public.operational_wall_posts where id=wall_id)<>0 or (select jsonb_array_length(coalesce(data->'entries','[]')) from public.maintenance_records where id=record_id)<>0 then raise exception 'granular deletion incomplete';end if;
 if (select count(*) from private.admin_content_deletion_audit)<>audit_before then raise exception 'granular deletion retained an administrative audit during tests';end if;
 for k in select * from private.content_kinds() where kind not in('toolboxes','toolbox_visual_catalog') loop
  loop
   entries:=public.admin_content('list',k.kind)->'rows';exit when jsonb_array_length(entries)=0;
   select jsonb_agg(value->'key') into entries from jsonb_array_elements(entries);
   perform public.admin_content('delete',k.kind,entries,'EXCLUIR');
  end loop;
 end loop;
 if exists(select 1 from public.maintenance_records) or exists(select 1 from public.internal_conversations) or (select jsonb_array_length(flights) from public.shared_app_state where id='main')<>0 then raise exception 'cleanup incomplete';end if;
 if before_boxes is distinct from (select jsonb_agg(to_jsonb(t) order by id) from public.toolboxes t) then raise exception 'demo boxes changed';end if;
 if (select count(*) from private.admin_content_deletion_audit)<>audit_before then raise exception 'content deletion retained an administrative audit during tests';end if;
end $$;
rollback;
