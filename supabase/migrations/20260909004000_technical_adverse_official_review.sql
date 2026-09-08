begin;
do $$
declare f text;
begin
 select pg_get_functiondef('private.guard_technical_case()'::regprocedure) into f;
 f:=replace(f,
   '''aircraft'',''unavailable'',''lastAdverseAt'',clock_timestamp()',
   '''aircraft'',''unavailable'',''officialClosed'',false,''lastAdverseAt'',clock_timestamp()');
 execute f;
end $$;
commit;
