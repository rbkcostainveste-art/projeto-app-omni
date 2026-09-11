create function public.admin_content_file_queue(p_done jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 for item in select value from jsonb_array_elements(p_done) loop
  delete from private.content_file_deletions where bucket=item->>'bucket' and name=item->>'name' and not exists(select 1 from storage.objects where bucket_id=item->>'bucket' and name=item->>'name');
 end loop;
 return coalesce((select jsonb_agg(to_jsonb(q)) from (select bucket,name from private.content_file_deletions order by bucket,name limit 100) q),'[]');
end $$;
revoke all on function public.admin_content_file_queue(jsonb) from public,anon,authenticated;
grant execute on function public.admin_content_file_queue(jsonb) to service_role;
select cron.schedule('admin-content-file-cleanup','* * * * *',$cron$
select net.http_post(url:='https://ecdhhfyobalpswojaklv.supabase.co/functions/v1/admin-content-file-cleanup',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='push_cron_secret')),body:='{}'::jsonb);
$cron$);
