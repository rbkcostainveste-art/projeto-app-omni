begin;
-- Existing cases without TC keep their history and can still receive comments.
-- New maintenance panes and reclassifications must reference a TC.
create function private.require_maintenance_fault_tc() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb:=private.technical_actor(); requires_tc boolean:=false;
begin
 if new.technical_case->>'report'='discrepancy' then
  if tg_op='INSERT' then
   requires_tc:=coalesce(a->>'role','') not in('commander','copilot');
  else
   requires_tc:=old.technical_case->>'report' is distinct from 'discrepancy' or nullif(trim(old.tc),'') is not null;
  end if;
  if requires_tc and nullif(trim(new.tc),'') is null then raise exception 'Informe o número da TC para abrir ou classificar esta pane';end if;
 end if;
 if new.tc is not null then new.tc:=trim(new.tc);end if;
 return new;
end $$;
revoke all on function private.require_maintenance_fault_tc() from public,anon,authenticated;
create trigger zzzz_require_maintenance_fault_tc before insert or update on public.maintenance_records for each row execute function private.require_maintenance_fault_tc();
commit;
