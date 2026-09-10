-- Keep the existing private buckets and access policies; allow the file types
-- already offered by the shared picker.
update storage.buckets set allowed_mime_types=array(select distinct mime from unnest(allowed_mime_types||array['application/pdf','image/heic','image/heif','video/quicktime','audio/aac']) mime)
where id in ('internal-chat','wall-media');

do $$
declare definition text; before_clause text:='not in(''image'',''video'',''audio'')'; after_clause text:='not in(''image'',''video'',''audio'',''document'')';
begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 if strpos(definition,before_clause)>0 then execute replace(definition,before_clause,after_clause);
 elsif strpos(definition,after_clause)=0 then raise exception 'Unexpected chat attachment validation; review migration before continuing';end if;
end $$;
