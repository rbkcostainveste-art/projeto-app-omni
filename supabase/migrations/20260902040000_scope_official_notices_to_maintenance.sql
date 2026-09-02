create or replace function private.normalize_official_wall_notice()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data ->> 'category' = 'Comunicado'
     and jsonb_array_length(coalesce(new.data -> 'actions', '[]'::jsonb)) = 0 then
    new.audience_area := 'maintenance';
    new.data := jsonb_set(new.data, '{audienceArea}', '"maintenance"'::jsonb, true);
  end if;

  return new;
end;
$$;

update public.operational_wall_posts
set audience_area = 'maintenance',
    data = jsonb_set(data, '{audienceArea}', '"maintenance"'::jsonb, true),
    updated_at = now()
where data ->> 'category' = 'Comunicado'
  and jsonb_array_length(coalesce(data -> 'actions', '[]'::jsonb)) = 0;
