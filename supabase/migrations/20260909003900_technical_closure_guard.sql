begin;
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,'if c->>''investigation'' in(''aprs'',''monitoring'') and not valid_aprs then', $patch$
 if c->>'investigation'='monitoring' and (c->>'official'<>'linked' or not coalesce((c->>'officialClosed')::boolean,false)) then raise exception 'Monitoramento pós-APRS exige discrepância encerrada no eDB';end if;
 if c->>'investigation' in('aprs','monitoring') and not valid_aprs then
 $patch$);
 f:=replace(f,'if c->>''investigation''=''closed'' and o->>''investigation'' is distinct from ''closed'' then', $patch$
 if c->>'investigation'='closed' and o->>'investigation' is distinct from 'closed' then
  if coalesce((c->>'critical')::boolean,false) then raise exception 'Avalie o alerta crítico antes de encerrar o caso';end if;
  if c->>'report' in('discrepancy','recurrence') and not valid_aprs then raise exception 'Encerramento técnico exige APRS válida após a última evidência adversa';end if;
 $patch$);
 execute f;
end $$;
commit;
