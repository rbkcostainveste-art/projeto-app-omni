-- Read-only, paginated lookup. SECURITY INVOKER retains maintenance_records RLS.
create or replace function public.normalize_occurrence_search(p_text text)
returns text language sql immutable parallel safe security invoker set search_path = ''
as $$ select pg_catalog.translate(pg_catalog.lower(coalesce(p_text,'')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') $$;
revoke all on function public.normalize_occurrence_search(text) from public, anon;
grant execute on function public.normalize_occurrence_search(text) to authenticated;

create or replace function public.search_related_occurrences(p_current uuid, p_filters jsonb default '{}'::jsonb, p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
 v_current public.maintenance_records%rowtype;
 v_query text := public.normalize_occurrence_search(p_filters->>'query');
 v_prefix text := pg_catalog.regexp_replace(public.normalize_occurrence_search(p_filters->>'prefix'),'[^a-z0-9]','','g');
 v_from date; v_until date; v_rows jsonb;
begin
 if auth.uid() is null then raise exception 'Entre novamente para pesquisar ocorrências.'; end if;
 if p_offset < 0 or p_offset > 1000000 or pg_catalog.jsonb_typeof(p_filters) <> 'object' or length(v_query)>160 or length(v_prefix)>20 then raise exception 'Filtros inválidos.'; end if;
 select * into v_current from public.maintenance_records where id=p_current;
 if not found then raise exception 'Ocorrência atual indisponível para este usuário.'; end if;
 v_from := nullif(p_filters->>'from','')::date; v_until := nullif(p_filters->>'until','')::date;
 if v_from>v_until then raise exception 'Confira o período informado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb) into v_rows from (
  select r.* from public.maintenance_records r
  where r.id<>p_current and not coalesce(v_current.data->'links','[]'::jsonb) ? r.id::text
   and (coalesce(p_filters->>'base','')='' or r.base=p_filters->>'base')
   and (coalesce(p_filters->>'model','')='' or r.model=p_filters->>'model')
   and (coalesce(p_filters->>'status','')='' or r.status=p_filters->>'status')
   and (coalesce(p_filters->>'type','')='' or r.record_type=p_filters->>'type')
   and (v_prefix='' or position(v_prefix in pg_catalog.regexp_replace(public.normalize_occurrence_search(r.prefix),'[^a-z0-9]','','g'))>0)
   and (v_from is null or r.created_at >= (v_from::timestamp at time zone 'America/Sao_Paulo'))
   and (v_until is null or r.created_at < ((v_until+1)::timestamp at time zone 'America/Sao_Paulo'))
   and not exists (
    select 1 from pg_catalog.regexp_split_to_table(pg_catalog.btrim(v_query),'\s+') term
    where term<>'' and position(term in public.normalize_occurrence_search(concat_ws(' ',r.prefix,r.ticket_code,r.title,r.data->>'description',r.tc,r.model)))=0
     and position(pg_catalog.regexp_replace(term,'[^a-z0-9]','','g') in pg_catalog.regexp_replace(public.normalize_occurrence_search(concat_ws(' ',r.prefix,r.ticket_code,r.tc)),'[^a-z0-9]','','g'))=0
   )
  order by r.created_at desc,r.id desc limit 41 offset p_offset
 ) page;
 return jsonb_build_object('items',v_rows,'hasMore',jsonb_array_length(v_rows)>40);
end $$;
revoke all on function public.search_related_occurrences(uuid,jsonb,integer) from public, anon;
grant execute on function public.search_related_occurrences(uuid,jsonb,integer) to authenticated;
create index if not exists maintenance_records_recent_idx on public.maintenance_records(created_at desc,id desc);
