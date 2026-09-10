do $$ declare f text;begin
 select pg_get_functiondef('private.technical_deadline_alerts()'::regprocedure) into f;
 f:=replace(f,$a$and r.technical_case#>>'{disposition,type}'='MEL'$a$,$b$and r.technical_case#>>'{disposition,type}'='MEL'
 and (s.kind='meloverdue:' or (coalesce(nullif(r.technical_case#>>'{disposition,alertHours}','')::int,48)>24 and nullif(r.technical_case#>>'{disposition,deadline}','')::timestamptz>now()))$b$);
 f:=replace(f,$a$<=now()+interval '24 hours'
 on conflict do nothing;$a$,$b$<=now()+interval '24 hours'
 and (r.technical_case#>>'{disposition,type}' is distinct from 'MEL' or nullif(r.technical_case#>>'{disposition,deadline}','')::timestamptz>now())
 on conflict do nothing;$b$);
 execute f;
end $$;
