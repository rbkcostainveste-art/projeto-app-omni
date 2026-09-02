create or replace function private.normalize_official_wall_notice()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data->>'category' = 'Comunicado'
     and jsonb_array_length(coalesce(new.data->'actions', '[]'::jsonb)) = 0 then
    new.audience_area := 'general';
    new.data := jsonb_set(new.data, '{audienceArea}', '"general"'::jsonb, true);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_official_wall_notice on public.operational_wall_posts;
create trigger normalize_official_wall_notice
before insert on public.operational_wall_posts
for each row execute function private.normalize_official_wall_notice();
