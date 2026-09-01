create table if not exists public.maintenance_ticket_sequences(
  kind text not null,
  prefix text not null,
  period text not null,
  last_value integer not null default 0,
  primary key(kind,prefix,period)
);
alter table public.maintenance_ticket_sequences enable row level security;
revoke all on table public.maintenance_ticket_sequences from public,anon,authenticated;

create or replace function public.next_maintenance_ticket_code(p_kind text,p_prefix text,p_at timestamptz default now())
returns text language plpgsql security definer set search_path='' as $$
declare v_kind text:=upper(regexp_replace(p_kind,'[^A-Za-z0-9]','','g')); v_prefix text:=upper(regexp_replace(p_prefix,'[^A-Za-z0-9]','','g')); v_period text:=to_char(p_at at time zone 'America/Sao_Paulo','YYYYMM'); v_value integer;
begin
  insert into public.maintenance_ticket_sequences(kind,prefix,period,last_value) values(v_kind,v_prefix,v_period,1)
  on conflict(kind,prefix,period) do update set last_value=public.maintenance_ticket_sequences.last_value+1
  returning last_value into v_value;
  return v_kind||'-'||v_prefix||'-'||v_period||'-'||lpad(v_value::text,3,'0');
end $$;
revoke all on function public.next_maintenance_ticket_code(text,text,timestamptz) from public,anon,authenticated;

alter table public.maintenance_records add column if not exists ticket_code text;

create or replace function public.assign_maintenance_ticket_code()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text;
begin
  if nullif(new.ticket_code,'') is null then
    v_kind:=case new.record_type when 'fault' then 'PAN' when 'discrepancy' then 'DIS' else 'PRG' end;
    new.ticket_code:=public.next_maintenance_ticket_code(v_kind,new.prefix,coalesce(new.created_at,now()));
  end if;
  new.data:=coalesce(new.data,'{}'::jsonb)||jsonb_build_object('ticketCode',new.ticket_code);
  return new;
end $$;
revoke all on function public.assign_maintenance_ticket_code() from public,anon,authenticated;
drop trigger if exists assign_maintenance_ticket_code on public.maintenance_records;
create trigger assign_maintenance_ticket_code before insert on public.maintenance_records for each row execute function public.assign_maintenance_ticket_code();

do $$ declare v_record record; begin
  for v_record in select id,record_type,prefix,created_at from public.maintenance_records where ticket_code is null order by created_at,id loop
    update public.maintenance_records set ticket_code=public.next_maintenance_ticket_code(case v_record.record_type when 'fault' then 'PAN' when 'discrepancy' then 'DIS' else 'PRG' end,v_record.prefix,v_record.created_at) where id=v_record.id;
  end loop;
  update public.maintenance_records set data=data||jsonb_build_object('ticketCode',ticket_code) where data->>'ticketCode' is distinct from ticket_code;
end $$;
alter table public.maintenance_records alter column ticket_code set not null;
create unique index if not exists maintenance_records_ticket_code_key on public.maintenance_records(ticket_code);

create or replace function public.publish_maintenance_record_to_wall()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_wall_id text:=gen_random_uuid()::text; v_at text:=now()::text; v_label text; v_priority text; v_data jsonb; begin
  if not (new.record_type='fault' or new.record_type='discrepancy' and new.priority='urgent') then return new; end if;
  v_label:=case new.record_type when 'fault' then 'Pane' else 'Discrepância' end;
  v_priority:=case when new.priority='urgent' then 'urgent' else 'routine' end;
  v_data:=jsonb_build_object('id',v_wall_id,'ticketCode',new.ticket_code,'title',v_label||' · '||new.prefix||' · '||new.title,'body',coalesce(new.data->>'description',''),'base',new.base,'audienceArea','maintenance','category',v_label,'priority',v_priority,'pinned',false,'essential',false,'resolved',false,'createdBy',new.created_by,'createdAt',v_at,'updatedAt',v_at,'revision',1,'attachments','[]'::jsonb,'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('employeeNumber',new.created_by,'at',v_at,'event','Criou '||lower(v_label))),'actions','[]'::jsonb,'maintenanceRecordId',new.id::text);
  insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data) values(v_wall_id,new.base,'maintenance',false,false,false,v_data);
  return new;
end $$;
revoke all on function public.publish_maintenance_record_to_wall() from public,anon,authenticated;
