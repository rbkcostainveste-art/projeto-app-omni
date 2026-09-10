-- Original inputs remain private to the authenticated device owner.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assistant-inputs','assistant-inputs',false,20971520,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "assistant input owner upload" on storage.objects for insert to authenticated
with check(bucket_id='assistant-inputs' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid())));
create policy "assistant input owner read" on storage.objects for select to authenticated
using(bucket_id='assistant-inputs' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.device_identities d where d.auth_user_id=(select auth.uid())));
create policy "assistant input owner delete" on storage.objects for delete to authenticated
using(bucket_id='assistant-inputs' and split_part(name,'/',1)=(select auth.uid())::text);

-- The first observation is immutable. Technical edits already have a separate audit trail.
create or replace function private.preserve_original_observation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare original jsonb;
begin
 if tg_op='UPDATE' then
  original:=coalesce(old.technical_case->'originalObservation',jsonb_build_object('title',old.title,'description',old.data->>'description','at',old.created_at));
 else
  original:=coalesce(new.technical_case->'originalObservation',jsonb_build_object('title',new.title,'description',new.data->>'description','at',now()));
 end if;
 if jsonb_typeof(original)<>'object' or octet_length(original::text)>40000 then raise exception 'Observação original inválida';end if;
 new.technical_case:=jsonb_set(coalesce(new.technical_case,'{}'::jsonb),'{originalObservation}',original);
 return new;
end $$;
revoke all on function private.preserve_original_observation() from public,anon,authenticated;
create trigger aa_preserve_original_observation before insert or update on public.maintenance_records
for each row execute function private.preserve_original_observation();
