begin;
create function private.technical_valid_disposition(c jsonb) returns boolean language sql stable set search_path='' as $$
 select not coalesce((c->>'critical')::boolean,false) and coalesce(c->>'investigation','')<>'test_failed' and (
  (nullif(c->>'aprsRef','') is not null and nullif(c->>'aprsBy','') is not null and coalesce((c->>'officialClosed')::boolean,false)
   and (nullif(c->>'lastAdverseAt','') is null or (c->>'aprsAt')::timestamptz>(c->>'lastAdverseAt')::timestamptz))
  or coalesce(c#>>'{disposition,type}' in('MEL','CDL','procedure') and nullif(c#>>'{disposition,authorizedBy}','') is not null and (c#>>'{disposition,deadline}')::timestamptz>now()
   and (nullif(c->>'lastAdverseAt','') is null or (c#>>'{disposition,authorizedAt}')::timestamptz>(c->>'lastAdverseAt')::timestamptz),false))
$$;
revoke all on function private.technical_valid_disposition(jsonb) from public,anon,authenticated;
do $$
declare f text; start_at int; end_at int;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 start_at:=strpos(f,'if c->>''aircraft'' in(''released'',''deferred'',''monitoring'') and (tg_op=');
 end_at:=strpos(substring(f from start_at),'new.technical_case:=');
 if start_at=0 or end_at=0 then raise exception 'Cross-case guard changed; review migration';end if;
 f:=substring(f from 1 for start_at-1)||$patch$
 if c->>'aircraft' in('released','deferred','monitoring') and (tg_op='INSERT' or c is distinct from o) and exists(
  select 1 from public.maintenance_records other where other.prefix=new.prefix and other.id<>new.id and other.record_type<>'inspection'
  and (other.technical_case->>'aircraft' in('unavailable','maintenance') or coalesce((other.technical_case->>'critical')::boolean,false) or other.technical_case->>'investigation'='test_failed'
    or (other.technical_case->>'report' in('discrepancy','recurrence') and not coalesce(private.technical_valid_disposition(other.technical_case),false)))
 ) then raise exception 'Outro caso da aeronave exige disposição formal. Confira os casos ativos antes de registrar liberação';end if;
 $patch$||substring(f from start_at+end_at-1);
 execute f;
 select pg_get_functiondef('public.technical_case_action(text,uuid,jsonb)'::regprocedure) into f;
 f:=replace(f,'if p_action=''config'' then', $patch$
 if p_action='alerts' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc),'[]') from (select t.* from public.technical_case_alerts t join public.maintenance_records m on m.id=t.record_id where t.employee_number=a->>'employee' and ((t.kind='critical' and coalesce((m.technical_case->>'critical')::boolean,false)) or (t.kind='deadline:'||(m.technical_case#>>'{disposition,deadline}') and m.technical_case->>'aircraft'='deferred')) order by t.at desc limit 30)x);
 end if;
 if p_action='config' then
 $patch$);
 execute f;
end $$;
commit;
