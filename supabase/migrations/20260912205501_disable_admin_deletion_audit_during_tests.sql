begin;

-- Test phase: administrative deletions must not retain content snapshots or
-- deletion history. Keep the ADM authorization and file cleanup unchanged.
-- Re-enabling retention for operational use requires an explicit migration.
do $$
declare
  definition text;
  audit_insert_pattern text := $pattern$insert into private\.admin_content_deletion_audit\(employee_number,kind,item_key,snapshot\)[[:space:]]+values\(actor_employee,('files'|k\.kind),item,row_data\);$pattern$;
begin
  select pg_get_functiondef('public.admin_content(text,text,jsonb,text,integer)'::regprocedure)
  into definition;

  if (select count(*) from regexp_matches(definition,audit_insert_pattern,'g')) <> 5 then
    raise exception 'Expected five administrative deletion audit writes';
  end if;

  definition := regexp_replace(definition,audit_insert_pattern,'','g');
  definition := replace(definition,E'  actor_employee text;\n','');
  definition := replace(definition,E'  select d.employee_number into actor_employee\n  from public.device_identities d where d.auth_user_id=auth.uid();\n','');

  if position('private.admin_content_deletion_audit' in definition)>0
     or position('if not private.content_admin()' in definition)=0 then
    raise exception 'Administrative deletion audit removal or ADM guard verification failed';
  end if;

  execute definition;
end $$;

-- TRUNCATE also releases the space occupied by the discarded snapshots.
-- The empty private table remains available for a future retention policy.
truncate table private.admin_content_deletion_audit restart identity;
comment on table private.admin_content_deletion_audit is
  'Administrative deletion retention disabled and snapshots cleared during app testing. Re-enable only by explicit migration.';

commit;
