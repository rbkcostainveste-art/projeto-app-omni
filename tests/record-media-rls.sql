-- Transaction-only integration check: all records and objects roll back.
begin;
create temporary table media_check as
 select gen_random_uuid() record_id,d.auth_user_id uploader,d.employee_number,d.assigned_base base,
 (select auth_user_id from public.device_identities where access_profile='coordination' and not is_admin limit 1) outsider
 from public.device_identities d where d.access_profile='mechanic' and not d.is_admin and d.assigned_base is not null limit 1;
grant select on media_check to authenticated;
insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,created_by,data)
select record_id,'fault',base,'S92','QA-MEDIA','not_logged','open','Teste transacional de anexos',employee_number,jsonb_build_object('description','Teste sem persistência','entries','[]'::jsonb,'assignedTo','[]'::jsonb) from media_check;
insert into storage.objects(bucket_id,name)
select 'record-media','maintenance/'||record_id||'/'||uploader||'/teste.png' from media_check;
insert into storage.objects(bucket_id,name) select 'record-media','maintenance/'||record_id||'/'||gen_random_uuid()||'/reader.png' from media_check;
select set_config('request.jwt.claim.sub',(select uploader::text from media_check),true);
set local role authenticated;
do $$declare r uuid; path text;begin
 select record_id,'maintenance/'||record_id||'/'||uploader||'/teste.png' into r,path from media_check;
 if r is null then raise exception 'Fixture sem usuário elegível';end if;
 if not exists(select 1 from storage.objects where bucket_id='record-media' and name=path) then raise exception 'Autor não consegue ler anexo';end if;
 if not exists(select 1 from storage.objects where bucket_id='record-media' and split_part(name,'/',2)=r::text and name like '%/reader.png') then raise exception 'Leitor autorizado não acessou mídia de outro autor';end if;
 perform public.append_maintenance_media(r,jsonb_build_array(jsonb_build_object('id','media-test','name','teste.png','type','image','bucket','record-media','url',path)));
 if (select jsonb_array_length(data->'attachments') from public.maintenance_records where id=r)<>1 then raise exception 'Anexo não salvo no registro antigo';end if;
 if (select jsonb_array_length(data->'entries') from public.maintenance_records where id=r)<>1 then raise exception 'Auditoria não salva';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select auth_user_id::text from public.device_identities where access_profile='leader_inspector' and assigned_base=(select base from media_check) limit 1),true);
set local role authenticated;
do $$declare r uuid; post_id text; media jsonb;begin
 select record_id into r from media_check;
 media:=jsonb_build_array(jsonb_build_object('id','task-image','name','task.png','type','image','bucket','record-media','url','maintenance/'||r||'/'||auth.uid()||'/task.png'));
 post_id:=public.create_maintenance_request(r,'Procedimentos','Teste de geração com imagem',array[]::text[],'',jsonb_build_object('attachments',media::text));
 if (select data->'attachments' from public.operational_wall_posts where id=post_id) is distinct from media then raise exception 'Ação sem anexos';end if;
 if not exists(select 1 from public.maintenance_records m,jsonb_array_elements(m.data->'entries') e where m.id=r and e->>'wallPostId'=post_id and e->'attachments'=media) then raise exception 'Timeline sem anexo da ação';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select outsider::text from media_check),true);
set local role authenticated;
do $$declare r uuid;begin
 select record_id into r from media_check;
 if exists(select 1 from storage.objects where bucket_id='record-media' and split_part(name,'/',2)=r::text) then raise exception 'Coordenação acessou mídia técnica';end if;
 begin
 perform public.append_maintenance_media(r,'[{"id":"invalid","name":"x","type":"image","bucket":"record-media","url":"invalid"}]');
 raise exception 'UNEXPECTED_PERMISSION';
 exception when others then if sqlerrm='UNEXPECTED_PERMISSION' then raise;end if;end;
end $$;
reset role;
rollback;
