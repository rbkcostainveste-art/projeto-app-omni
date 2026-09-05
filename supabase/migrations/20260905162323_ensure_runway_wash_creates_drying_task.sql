create or replace function private.enqueue_runway_compressor_drying()
returns trigger language plpgsql security definer set search_path='' as $$
declare employee text;
begin
 if new.checks->>'compressorWash'='yes' and (tg_op='INSERT' or coalesce(old.checks->>'compressorWash','')<>'yes') then
  select d.employee_number into employee from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
  if employee is null then raise exception 'Identificação ativa necessária para confirmar a lavagem'; end if;
  insert into public.compressor_drying_tasks(source_type,source_id,prefix,model,base,reason,triggered_by,triggered_at)
  values('runway_handover',new.id,new.prefix,new.model,new.base,'Compressores lavados na Passagem de Pista',employee,now())
  on conflict(source_type,source_id) do update set status='pending',completed_by=null,completed_at=null,prefix=excluded.prefix,model=excluded.model,base=excluded.base,triggered_by=excluded.triggered_by,triggered_at=excluded.triggered_at;
 end if;
 return new;
end $$;
revoke all on function private.enqueue_runway_compressor_drying() from public,anon,authenticated;
drop trigger if exists enqueue_drying_after_runway_wash on public.runway_handovers;
create trigger enqueue_drying_after_runway_wash after insert or update of checks on public.runway_handovers for each row execute function private.enqueue_runway_compressor_drying();
