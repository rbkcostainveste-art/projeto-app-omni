begin;
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'changed boolean; entry jsonb;','changed boolean; entry jsonb; evidence text;');
 f:=replace(f,'changed:=tg_op=''INSERT'' or new.data is distinct from old.data or new.title is distinct from old.title;', $patch$
 changed:=tg_op='INSERT' or new.data is distinct from old.data or new.title is distinct from old.title or c->'action' is distinct from o->'action';
 evidence:=case when tg_op='INSERT' then new.title||' '||coalesce(new.data->>'description','')||' '||coalesce(new.data->'entries','[]')::text else
  case when new.title is distinct from old.title then new.title else '' end||' '||case when new.data->>'description' is distinct from old.data->>'description' then coalesce(new.data->>'description','') else '' end||' '||coalesce((select string_agg(e->>'description',' ') from jsonb_array_elements(coalesce(new.data->'entries','[]'))e where not coalesce(old.data->'entries','[]') @> jsonb_build_array(e)),'') end;
 if c->'action' is distinct from o->'action' then evidence:=evidence||' '||coalesce(c->'action','{}')::text;end if;
 $patch$);
 f:=replace(f,'lower(new.title||'' ''||new.data::text)','lower(evidence)');
 f:=replace(f,'if changed and coalesce((c->>''critical'')::boolean,false) then c:=c||''{"aircraft":"unavailable"}'';end if;', 'if changed and coalesce((c->>''critical'')::boolean,false) then c:=c||jsonb_build_object(''aircraft'',''unavailable'',''lastAdverseAt'',now());end if;');
 f:=replace(f,'c:=c||''{"investigation":"test_failed","aircraft":"unavailable"}'';', 'c:=c||jsonb_build_object(''investigation'',''test_failed'',''aircraft'',''unavailable'',''lastAdverseAt'',now());');
 f:=replace(f,'valid_aprs:=nullif(c->>''aprsRef'','''') is not null and nullif(c->>''aprsBy'','''') is not null;', 'valid_aprs:=nullif(c->>''aprsRef'','''') is not null and nullif(c->>''aprsBy'','''') is not null and (nullif(c->>''lastAdverseAt'','''') is null or (c->>''aprsAt'')::timestamptz>(c->>''lastAdverseAt'')::timestamptz);');
 -- Client cannot erase adverse evidence metadata.
 f:=replace(f,'select data into cfg from private.technical_operator_config where id;', 'c:=c||jsonb_build_object(''lastAdverseAt'',o->>''lastAdverseAt''); select data into cfg from private.technical_operator_config where id;');
 execute f;
end $$;
-- Confirmed attachments cannot be silently removed through the storage API.
create function private.technical_media_referenced(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.maintenance_records r where jsonb_path_query_array(r.data,'$.**.url') ? path)
$$;
revoke all on function private.technical_media_referenced(text) from public,anon;
grant execute on function private.technical_media_referenced(text) to authenticated;
create policy "preserve confirmed technical evidence" on storage.objects as restrictive for delete to authenticated using(bucket_id<>'record-media' or not private.technical_media_referenced(name));
commit;
