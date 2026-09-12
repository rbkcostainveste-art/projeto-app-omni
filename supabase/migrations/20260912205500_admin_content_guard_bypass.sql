begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into definition;
  if strpos(definition,'admin_content may remove protected entries')=0 then
    definition:=regexp_replace(
      definition,
      E'\\nbegin\\n',
      E'\nbegin\n -- admin_content may remove protected entries after server-side ADM validation.\n if private.content_admin() then\n  if tg_op=''DELETE'' then return old;end if;\n  return new;\n end if;\n'
    );
    execute definition;
  end if;
end
$$;

commit;
