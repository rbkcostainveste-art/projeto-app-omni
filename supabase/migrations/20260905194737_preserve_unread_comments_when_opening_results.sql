do $$ declare definition text;begin
select pg_get_functiondef('public.mark_wall_read(text,timestamptz,timestamptz)'::regprocedure) into definition;
definition:=replace(definition,'least(p_comments_at,now())','case when p_comments_at is not null then least(p_comments_at,now()) end');
definition:=replace(definition,'least(p_content_at,now())','case when p_content_at is not null then least(p_content_at,now()) end');execute definition;
end $$;
