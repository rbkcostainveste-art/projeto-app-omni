create table if not exists public.operational_wall_posts (
  id text primary key,
  base text not null default 'Todas',
  pinned boolean not null default false,
  essential boolean not null default false,
  resolved boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operational_wall_posts enable row level security;
revoke all on table public.operational_wall_posts from anon;
grant select,insert,update,delete on table public.operational_wall_posts to authenticated;

create policy "identified devices read operational wall"
on public.operational_wall_posts for select to authenticated
using (exists (select 1 from public.device_identities where auth_user_id=(select auth.uid())));

create policy "administrators publish operational wall posts"
on public.operational_wall_posts for insert to authenticated
with check (exists (select 1 from public.device_identities where auth_user_id=(select auth.uid()) and is_admin));

create policy "administrators update operational wall posts"
on public.operational_wall_posts for update to authenticated
using (exists (select 1 from public.device_identities where auth_user_id=(select auth.uid()) and is_admin))
with check (exists (select 1 from public.device_identities where auth_user_id=(select auth.uid()) and is_admin));

create policy "administrators delete operational wall posts"
on public.operational_wall_posts for delete to authenticated
using (exists (select 1 from public.device_identities where auth_user_id=(select auth.uid()) and is_admin));

create or replace function public.update_operational_wall_post(p_id text,p_data jsonb,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_identity public.device_identities; v_current public.operational_wall_posts; v_revision bigint;
begin
  select * into v_identity from public.device_identities where auth_user_id=auth.uid();
  if v_identity.auth_user_id is null then raise exception 'Aparelho não identificado'; end if;
  select * into v_current from public.operational_wall_posts where id=p_id for update;
  if v_current.id is null then raise exception 'Publicação não encontrada'; end if;
  if v_current.revision<>p_expected_revision then raise exception 'Publicação alterada por outro usuário'; end if;
  if not v_identity.is_admin then
    if (p_data-array['comments','views','acknowledgements','history','actions','updatedAt','revision'])<>(v_current.data-array['comments','views','acknowledgements','history','actions','updatedAt','revision']) then
      raise exception 'Somente a liderança altera o conteúdo oficial';
    end if;
    if jsonb_array_length(coalesce(p_data->'actions','[]'))<>jsonb_array_length(coalesce(v_current.data->'actions','[]')) or exists(
      select 1 from jsonb_array_elements(coalesce(p_data->'actions','[]')) proposed
      where not exists(
        select 1 from jsonb_array_elements(coalesce(v_current.data->'actions','[]')) original
        where original->>'id'=proposed->>'id' and
        (original-array['status','views','acknowledgements','executions'])=(proposed-array['status','views','acknowledgements','executions'])
      )
    ) then raise exception 'Somente a liderança altera a definição das ações'; end if;
  end if;
  update public.operational_wall_posts set
    base=case when v_identity.is_admin then coalesce(p_data->>'base',base) else base end,
    pinned=case when v_identity.is_admin then coalesce((p_data->>'pinned')::boolean,pinned) else pinned end,
    essential=case when v_identity.is_admin then coalesce((p_data->>'essential')::boolean,essential) else essential end,
    resolved=case when v_identity.is_admin then coalesce((p_data->>'resolved')::boolean,resolved) else resolved end,
    data=p_data,revision=revision+1,updated_at=now()
  where id=p_id returning revision into v_revision;
  return v_revision;
end $$;

revoke all on function public.update_operational_wall_post(text,jsonb,bigint) from public,anon;
grant execute on function public.update_operational_wall_post(text,jsonb,bigint) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('wall-media','wall-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "identified devices read wall media"
on storage.objects for select to authenticated
using (bucket_id='wall-media' and exists (select 1 from public.device_identities where auth_user_id=(select auth.uid())));

create policy "identified devices upload wall media"
on storage.objects for insert to authenticated
with check (bucket_id='wall-media' and exists (select 1 from public.device_identities where auth_user_id=(select auth.uid())));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='operational_wall_posts') then
    alter publication supabase_realtime add table public.operational_wall_posts;
  end if;
end $$;

create index if not exists operational_wall_posts_feed_idx
on public.operational_wall_posts (pinned desc,updated_at desc);
