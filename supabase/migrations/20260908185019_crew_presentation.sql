create table public.crew_presentation_settings(id boolean primary key default true check(id),flight_minutes integer not null default 45 check(flight_minutes between 0 and 1440),maintenance_minutes integer not null default 45 check(maintenance_minutes between 0 and 1440),updated_at timestamptz not null default now());
insert into public.crew_presentation_settings(id) values(true);
create table public.crew_checkins(employee_number text not null references public.authorized_users(employee_number),flight_date date not null,checked_at timestamptz not null default now(),expected_at timestamptz not null,flight_id text not null,flight_snapshot jsonb not null,lead_minutes integer not null,primary key(employee_number,flight_date));
alter table public.crew_presentation_settings enable row level security;
alter table public.crew_checkins enable row level security;
revoke all on public.crew_presentation_settings,public.crew_checkins from anon,authenticated;
create function public.crew_presentation(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; subject text; day date; f jsonb; scheduled timestamptz; expected timestamptz; lead integer; settings public.crew_presentation_settings; receipt public.crew_checkins; maintenance boolean;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null then raise exception 'Entre com um colaborador ativo';end if;
 select * into settings from public.crew_presentation_settings where id=true;
 if p_action='settings' then return to_jsonb(settings);end if;
 if p_action='configure' then
  if not public.help_video_admin() then raise exception 'Somente administração configura a apresentação';end if;
  update public.crew_presentation_settings set flight_minutes=(p_payload->>'flightMinutes')::int,maintenance_minutes=(p_payload->>'maintenanceMinutes')::int,updated_at=now() where id=true returning * into settings;
  return to_jsonb(settings);
 end if;
 subject:=coalesce(nullif(p_payload->>'user',''),actor);
 if subject<>actor and not public.help_video_admin() then raise exception 'Apresentação de outro tripulante indisponível';end if;
 day:=coalesce((p_payload->>'date')::date,(now() at time zone 'America/Sao_Paulo')::date);
 select flight into f from public.shared_app_state s cross join lateral jsonb_array_elements(s.flights) flight
 where s.id='main' and flight->>'date'=day::text and subject in (flight->>'commander',flight->>'copilot',flight->>'flightAttendant')
 and coalesce(flight->>'deletedAt','')='' and coalesce(flight->>'cancelled','false')<>'true'
 and flight->>'departure' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
 order by flight->>'departure',flight->>'id' limit 1;
 if f is not null then
  maintenance:=coalesce(f->>'maintenancePostId',f->>'compressorDryingTaskId','')<>'';
  lead:=case when maintenance then settings.maintenance_minutes else settings.flight_minutes end;
  scheduled:=(day::text||' '||(f->>'departure'))::timestamp at time zone 'America/Sao_Paulo';
  expected:=scheduled-make_interval(mins=>lead);
 end if;
 select * into receipt from public.crew_checkins where employee_number=subject and flight_date=day;
 if p_action='checkin' then
  if subject<>actor then raise exception 'Registre somente seu próprio check-in';end if;
  if receipt.employee_number is null then
   if f is null then raise exception 'Nenhuma atividade com horário e tripulação definida nesta data';end if;
   if (now() at time zone 'America/Sao_Paulo')::date not between (expected at time zone 'America/Sao_Paulo')::date and day then raise exception 'O check-in estará disponível no dia da apresentação';end if;
   insert into public.crew_checkins(employee_number,flight_date,expected_at,flight_id,flight_snapshot,lead_minutes) values(actor,day,expected,f->>'id',f,lead) on conflict do nothing;
   select * into receipt from public.crew_checkins where employee_number=actor and flight_date=day;
  end if;
 elsif p_action<>'summary' then raise exception 'Ação inválida';end if;
 return jsonb_build_object('date',day,'timezone','America/Sao_Paulo','flight',f,'scheduledAt',scheduled,'expectedAt',expected,'leadMinutes',lead,'checkin',case when receipt.employee_number is null then null else to_jsonb(receipt) end,
 'changed',receipt.employee_number is not null and (receipt.expected_at is distinct from expected or receipt.flight_id is distinct from f->>'id'),
 'canCheckin',f is not null and receipt.employee_number is null and subject=actor and (now() at time zone 'America/Sao_Paulo')::date between (expected at time zone 'America/Sao_Paulo')::date and day);
end $$;
revoke all on function public.crew_presentation(text,jsonb) from public,anon;
grant execute on function public.crew_presentation(text,jsonb) to authenticated;
