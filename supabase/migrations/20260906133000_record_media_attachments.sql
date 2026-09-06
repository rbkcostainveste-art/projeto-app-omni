-- Draft uploads are private to their uploader until their target is saved.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('record-media','record-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/aac'])
on conflict(id) do nothing;
create policy "record media upload own files" on storage.objects for insert to authenticated with check (
 bucket_id='record-media' and split_part(name,'/',3)=(select auth.uid())::text
 and split_part(name,'/',1) in ('maintenance','wall')
 and exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid()))
);
create policy "record media read authorized target" on storage.objects for select to authenticated using (
 bucket_id='record-media' and (
 split_part(name,'/',3)=(select auth.uid())::text
 or (split_part(name,'/',1)='maintenance' and exists(select 1 from public.maintenance_records r where r.id::text=split_part(name,'/',2)))
 or (split_part(name,'/',1)='wall' and exists(select 1 from public.operational_wall_posts p where p.id=split_part(name,'/',2)))
 ));
create policy "record media cleanup own uploads" on storage.objects for delete to authenticated using (
 bucket_id='record-media' and split_part(name,'/',3)=(select auth.uid())::text
);
-- Append without overwriting concurrent technical entries or attachments.
create or replace function public.append_maintenance_media(p_id uuid,p_attachments jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.maintenance_records; d public.device_identities;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into r from public.maintenance_records where id=p_id for update;
 if r.id is null or d.auth_user_id is null or not (d.is_admin or d.access_profile in ('legacy','mechanic','leader_inspector'))
 or (not d.is_admin and d.access_profile='mechanic' and d.assigned_base is not null and d.assigned_base<>r.base)
 then raise exception 'Registro indisponível para este usuário';end if;
 if jsonb_typeof(p_attachments) is distinct from 'array' or jsonb_array_length(p_attachments)=0 then raise exception 'Nenhum anexo informado';end if;
 if exists(select 1 from jsonb_array_elements(p_attachments) a where
 coalesce(a->>'bucket','')<>'record-media' or coalesce(a->>'type','') not in ('image','audio','video')
 or split_part(a->>'url','/',1)<>'maintenance' or split_part(a->>'url','/',2)<>p_id::text
 or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo fora do registro';end if;
 update public.maintenance_records set data=data||jsonb_build_object(
 'attachments',coalesce(data->'attachments','[]'::jsonb)||p_attachments,
 'entries',coalesce(data->'entries','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','status','description','Adicionou anexos ao registro','employeeNumber',d.employee_number,'at',now()))),revision=revision+1,updated_at=now() where id=p_id;
end $$;
revoke all on function public.append_maintenance_media(uuid,jsonb) from public,anon;
grant execute on function public.append_maintenance_media(uuid,jsonb) to authenticated;
-- Legacy wall attachments follow the same row permissions as their parent post.
drop policy if exists "users read authorized wall media" on storage.objects;
create policy "users read authorized wall media" on storage.objects for select to authenticated using (
 bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p where p.id=split_part(name,'/',1))
);
drop policy if exists "users upload authorized wall media" on storage.objects;
create policy "users upload authorized wall media" on storage.objects for insert to authenticated with check (
 bucket_id='wall-media' and exists(select 1 from public.operational_wall_posts p where p.id=split_part(name,'/',1))
);
-- Keep media submitted with a generated task in that task and its technical timeline.
create or replace function public.create_maintenance_request(p_record_id uuid,p_category text,p_title text,p_assigned_to text[],p_tc text,p_plan jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare v_post_id text; media jsonb;
begin
 v_post_id:=public.create_wall_action_from_maintenance_record(p_record_id,p_category,p_title,p_assigned_to,null,p_tc);
 if p_category<>'Procedimentos' then perform public.configure_maintenance_operation(v_post_id,p_plan);end if;
 media:=coalesce(nullif(p_plan->>'attachments','')::jsonb,'[]'::jsonb);
 if jsonb_typeof(media)<>'array' then raise exception 'Anexos inválidos';end if;
 if jsonb_array_length(media)>0 then
  if exists(select 1 from jsonb_array_elements(media) a where coalesce(a->>'bucket','')<>'record-media' or split_part(a->>'url','/',1)<>'maintenance' or split_part(a->>'url','/',2)<>p_record_id::text or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo fora do registro';end if;
  update public.operational_wall_posts set data=jsonb_set(data,'{attachments}',media),revision=revision+1 where operational_wall_posts.id=v_post_id;
  update public.maintenance_records set data=jsonb_set(data,'{entries}',(select jsonb_agg(case when e->>'wallPostId'=v_post_id then e||jsonb_build_object('attachments',media) else e end order by n) from jsonb_array_elements(data->'entries') with ordinality t(e,n))),revision=revision+1 where maintenance_records.id=p_record_id;
 end if;
 return v_post_id;
end $$;
revoke all on function public.create_maintenance_request(uuid,text,text,text[],text,jsonb) from public,anon;
grant execute on function public.create_maintenance_request(uuid,text,text,text[],text,jsonb) to authenticated;
