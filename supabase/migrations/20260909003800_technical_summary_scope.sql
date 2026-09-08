begin;
do $$
declare f text;
begin
 select pg_get_functiondef('public.cockpit(text,jsonb)'::regprocedure) into f;
 if strpos(f,'''technicalCase'',r.technical_case')=0 then raise exception 'Cockpit summary changed; review migration';end if;
 f:=replace(f,'''technicalCase'',r.technical_case','''technicalCase'',private.technical_axes(r.technical_case)');execute f;
 select pg_get_functiondef('private.guard_wall_technical_axes()'::regprocedure) into f;
 f:=replace(f,'rid:=new.data->>''maintenanceRecordId'';','rid:=nullif(new.data->>''maintenanceRecordId'','''');');execute f;
end $$;
commit;
