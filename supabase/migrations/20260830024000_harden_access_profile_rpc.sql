revoke all on function public.get_user_access_profiles() from public,anon;
grant execute on function public.get_user_access_profiles() to authenticated;
