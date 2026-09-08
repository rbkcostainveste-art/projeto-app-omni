insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cockpit-documents','cockpit-documents',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create function public.cockpit_document_access(p_path text,p_write boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor text; role_name text; admin boolean;
begin
 select u.employee_number,coalesce(u.job_role,u.access_profile),d.is_admin into actor,role_name,admin from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null or split_part(p_path,'/',2)='' then return false;end if;
 if p_write and not (admin or role_name in ('admin','app_manager','coordination','dispatch')) then return false;end if;
 return private.cockpit_access('document',null,split_part(p_path,'/',1),actor,false);
end $$;
revoke all on function public.cockpit_document_access(text,boolean) from public,anon;
grant execute on function public.cockpit_document_access(text,boolean) to authenticated;
create policy "cockpit document upload" on storage.objects for insert to authenticated with check(bucket_id='cockpit-documents' and public.cockpit_document_access(name,true));
create policy "cockpit document download" on storage.objects for select to authenticated using(bucket_id='cockpit-documents' and public.cockpit_document_access(name,false));
