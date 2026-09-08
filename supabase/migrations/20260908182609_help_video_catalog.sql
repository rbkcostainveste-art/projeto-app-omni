create function public.help_video_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active and (d.is_admin or u.access_profile in ('admin','app_manager') or u.job_role='app_manager'));
$$;
create function public.help_video_reader() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active);
$$;
revoke all on function public.help_video_admin(),public.help_video_reader() from public,anon;
grant execute on function public.help_video_admin(),public.help_video_reader() to authenticated;
create table public.help_videos (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 160),
 profile text not null, screen text not null, storage_path text not null unique,
 enabled boolean not null default true, created_at timestamptz not null default now(),
 constraint help_profile check(profile in ('all','legacy','admin','app_manager','mechanic','maintenance_assistant','toolroom','commander','copilot','flight_attendant','coordination','dispatch','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector')),
 constraint help_screen check(screen in ('wall','flights','activities','tools','coordination','admin','maintenance:service','maintenance:faults','maintenance:discrepancies','maintenance:passage'))
);
alter table public.help_videos enable row level security;
revoke all on public.help_videos from anon,authenticated;
grant select,insert,update,delete on public.help_videos to authenticated;
create policy help_read on public.help_videos for select to authenticated using (public.help_video_admin() or (enabled and public.help_video_reader()));
create policy help_manage on public.help_videos for all to authenticated using(public.help_video_admin()) with check(public.help_video_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('help-videos','help-videos',false,52428800,array['video/mp4','video/webm','video/quicktime']) on conflict(id) do nothing;
create policy help_media_read on storage.objects for select to authenticated using(bucket_id='help-videos' and (public.help_video_admin() or (public.help_video_reader() and exists(select 1 from public.help_videos v where v.storage_path=name and v.enabled))));
create policy help_media_insert on storage.objects for insert to authenticated with check(bucket_id='help-videos' and public.help_video_admin());
create policy help_media_delete on storage.objects for delete to authenticated using(bucket_id='help-videos' and public.help_video_admin());
