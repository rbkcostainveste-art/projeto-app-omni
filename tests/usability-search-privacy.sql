begin;
do $$
declare owner_id uuid; mechanic_id uuid; employee text; mechanic_base text; current_id uuid:=gen_random_uuid(); hidden_id uuid:=gen_random_uuid(); tag text:='QA'||replace(gen_random_uuid()::text,'-',''); result jsonb;
begin
 select auth_user_id,employee_number into owner_id,employee from public.device_identities where is_admin limit 1;
 select auth_user_id,assigned_base into mechanic_id,mechanic_base from public.device_identities where not is_admin and access_profile='mechanic' and assigned_base is not null limit 1;
 if owner_id is null or mechanic_id is null then raise exception 'Required authorized test identities unavailable';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,data) values
 (current_id,'fault',mechanic_base,'S92','PR-QAT','not_logged','open','QA current','QA-TC',employee,'{"description":"Synthetic search root","links":[]}'),
 (hidden_id,'fault','QA-private-search','S92','PR-QAT','not_logged','open',tag||' Altímetro privado','QA-TC',employee,'{"description":"Synthetic restricted record"}');
 insert into public.maintenance_records(id,record_type,base,model,prefix,priority,status,title,tc,created_by,created_at,data)
 select gen_random_uuid(),'fault',mechanic_base,'S92','PR-QAT','not_logged','open',tag||' Altímetro '||n,'QA-TC',employee,'2026-09-10 12:00:00+00'::timestamptz+n*interval '1 minute','{"description":"Intermitente em voo"}'::jsonb from generate_series(1,45) n;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 result:=public.search_related_occurrences(current_id,jsonb_build_object('query',tag||' altimetro','prefix','PRQAT','base',mechanic_base),0);
 if jsonb_array_length(result->'items')<>41 or not (result->>'hasMore')::boolean then raise exception 'Pagination first page failed';end if;
 if result->'items'->0->>'title'<>tag||' Altímetro 45' then raise exception 'Recent order failed';end if;
 result:=public.search_related_occurrences(current_id,jsonb_build_object('query',tag,'base',mechanic_base),40);
 if jsonb_array_length(result->'items')<>5 or (result->>'hasMore')::boolean then raise exception 'Pagination continuation failed';end if;
 result:=public.search_related_occurrences(current_id,jsonb_build_object('query',tag,'base',mechanic_base,'from','2026-09-11','until','2026-09-11'),0);
 if jsonb_array_length(result->'items')<>0 then raise exception 'Period filter failed';end if;
 perform set_config('request.jwt.claim.sub',mechanic_id::text,true);
 result:=public.search_related_occurrences(current_id,jsonb_build_object('query',tag,'base','QA-private-search'),0);
 if jsonb_array_length(result->'items')<>0 then raise exception 'Other base leaked through search';end if;
 begin
  perform public.search_related_occurrences(hidden_id,'{}',0);
  raise exception 'Unauthorized current record accepted';
 exception when raise_exception then
  if sqlerrm<>'Ocorrência atual indisponível para este usuário.' then raise;end if;
 end;
 execute 'reset role';
 if exists(select 1 from pg_proc where oid='public.search_related_occurrences(uuid,jsonb,integer)'::regprocedure and prosecdef) then raise exception 'Search bypasses RLS';end if;
 if has_function_privilege('anon','public.search_related_occurrences(uuid,jsonb,integer)','execute') then raise exception 'Anonymous RPC exposed';end if;
end $$;
rollback;
