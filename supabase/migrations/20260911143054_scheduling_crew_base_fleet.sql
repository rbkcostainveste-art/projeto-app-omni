create or replace function private.validate_scheduled_crew() returns trigger
language plpgsql security definer set search_path='' as $$
declare f jsonb; previous jsonb; member text; slot text; plane jsonb; target public.authorized_users;
begin
 for f in select value from jsonb_array_elements(coalesce(new.flights,'[]')) loop
  if coalesce(f->>'cancelled','false')='true' or coalesce(f->>'deletedAt','')<>'' then continue;end if;
  previous:=null;
  if tg_op='UPDATE' then select value into previous from jsonb_array_elements(coalesce(old.flights,'[]')) where value->>'id'=f->>'id' limit 1;end if;
  select value into plane from jsonb_array_elements(coalesce(new.catalogs->'aircraft','[]')) where value->>'prefix'=f->>'prefix' limit 1;
  foreach slot in array array['commander','copilot','flightAttendant'] loop
   member:=nullif(f->>slot,'');
   if member is null then continue;end if;
   if previous is not null and previous->>slot is not distinct from member and previous->>'prefix' is not distinct from f->>'prefix' then continue;end if;
   select * into target from public.authorized_users where employee_number=member and active;
   if target.employee_number is null or (slot='flightAttendant' and target.job_role<>'flight_attendant') or (slot<>'flightAttendant' and target.job_role not in('commander','copilot')) then raise exception 'Tripulante não habilitado para esta função';end if;
   if nullif(plane->>'base','') is null or target.assigned_base is distinct from plane->>'base' then raise exception 'Tripulante fora da base da aeronave. Atualize a base na Gestão de Pessoas';end if;
   if not exists(select 1 from unnest(target.fleets) fleet where regexp_replace(upper(fleet),'[^A-Z0-9]','','g')=regexp_replace(upper(plane->>'model'),'[^A-Z0-9]','','g')) then raise exception 'Tripulante sem habilitação para a frota da aeronave';end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function private.validate_scheduled_crew() from public,anon,authenticated;
create trigger validate_scheduled_crew before insert or update of flights on public.shared_app_state for each row execute function private.validate_scheduled_crew();
