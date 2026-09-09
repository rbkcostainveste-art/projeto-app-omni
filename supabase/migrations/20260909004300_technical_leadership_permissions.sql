begin;
do $$ declare f text; begin
 select pg_get_functiondef('public.create_wall_action_from_maintenance_record(uuid,text,text,text[],text,text)'::regprocedure) into f;
 f:=replace(f,'''maintenance_leader'',''maintenance_inspector'',''mechanic'') then','''maintenance_leader'',''maintenance_inspector'') then');
 f:=replace(f,'Somente mecânicos, inspetores e liderança podem gerar ações','Somente inspetores e liderança podem gerar ações');
 execute f;
end $$;
create function private.guard_direct_technical_fault() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor();
begin
 if new.technical_case->>'report'='discrepancy' and coalesce(a->>'role','') not in('admin','app_manager','maintenance_inspector','maintenance_coordinator','maintenance_manager','maintenance_director','commander','copilot') then
  raise exception 'Abra um relato técnico para avaliação. A abertura direta de pane exige inspetor/superior ou tripulação autorizada';
 end if;
 return new;
end $$;
revoke all on function private.guard_direct_technical_fault() from public,anon,authenticated;
create trigger zzz_guard_direct_technical_fault before insert on public.maintenance_records for each row execute function private.guard_direct_technical_fault();
commit;
