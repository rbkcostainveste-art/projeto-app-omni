-- Audience is independent of task assignments. Existing area/base policies still apply.
create or replace function private.wall_notice_visible(payload jsonb)
returns boolean language sql stable set search_path='' as $$
 select coalesce(jsonb_array_length(payload->'audienceRecipients'),0)=0
 or exists(select 1 from public.device_identities d where d.auth_user_id=auth.uid()
 and (payload->>'createdBy'=d.employee_number or payload->'audienceRecipients' ? d.employee_number));
$$;
revoke all on function private.wall_notice_visible(jsonb) from public,anon;
grant execute on function private.wall_notice_visible(jsonb) to authenticated;

create policy "notice audience limits visibility" on public.operational_wall_posts
as restrictive for select to authenticated using(private.wall_notice_visible(data));

create or replace function private.validate_notice_audience()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and not private.wall_notice_visible(old.data) then
  raise exception 'Publicação fora do seu público de visualização';
 end if;
 if new.data ? 'audienceRecipients' then
  if jsonb_typeof(new.data->'audienceRecipients') is distinct from 'array' then raise exception 'Público inválido';end if;
  if tg_op='INSERT' or new.data->'audienceRecipients' is distinct from old.data->'audienceRecipients' then
   if exists(select 1 from jsonb_array_elements(new.data->'audienceRecipients') r
     where jsonb_typeof(r)<>'string' or not exists(select 1 from public.authorized_users u where u.active and u.employee_number=r#>>'{}')) then raise exception 'Selecione colaboradores ativos';end if;
  end if;
 end if;
 if new.data->>'category' in ('Momento F.O.D','DDS','Avisos','Comunicados','Determinação') then
  if jsonb_array_length(coalesce(new.data->'actions','[]'))<>0 then raise exception 'Avisos não criam designações';end if;
  if trim(coalesce(new.data->>'body',''))='' and jsonb_array_length(coalesce(new.data->'attachments','[]'))=0 then raise exception 'Inclua conteúdo ou mídia';end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_notice_audience() from public,anon,authenticated;
create trigger validate_notice_audience before insert or update on public.operational_wall_posts
for each row execute function private.validate_notice_audience();
