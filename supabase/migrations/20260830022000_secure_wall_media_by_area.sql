drop policy if exists "identified devices read wall media" on storage.objects;
drop policy if exists "identified devices upload wall media" on storage.objects;

create policy "users read authorized wall media"
on storage.objects for select to authenticated
using (
  bucket_id = 'wall-media'
  and exists (
    select 1
    from public.operational_wall_posts p
    join public.device_identities d on d.auth_user_id = (select auth.uid())
    where p.id::text = split_part(storage.objects.name, '/', 1)
      and (
        d.is_admin
        or d.access_profile = 'legacy'
        or p.audience_area = 'general'
        or p.audience_area = 'operations' and d.access_profile in ('pilot', 'operations')
        or p.audience_area = 'maintenance' and d.access_profile in ('mechanic', 'leader_inspector')
      )
  )
);

create policy "users upload authorized wall media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wall-media'
  and exists (
    select 1
    from public.operational_wall_posts p
    join public.device_identities d on d.auth_user_id = (select auth.uid())
    where p.id::text = split_part(storage.objects.name, '/', 1)
      and (
        d.is_admin
        or d.access_profile = 'legacy'
        or p.audience_area = 'general'
        or p.audience_area = 'operations' and d.access_profile in ('pilot', 'operations')
        or p.audience_area = 'maintenance' and d.access_profile in ('mechanic', 'leader_inspector')
      )
  )
);
