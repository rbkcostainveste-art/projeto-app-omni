do $$ declare definition text; begin
 select pg_get_functiondef('private.operation_context(text)'::regprocedure) into definition;
 definition:=replace(definition,$old$x.value->>'date'||'T'||x.value->>'departure'$old$,$new$(x.value->>'date')||'T'||(x.value->>'departure')$new$);
 execute definition;
end $$;
