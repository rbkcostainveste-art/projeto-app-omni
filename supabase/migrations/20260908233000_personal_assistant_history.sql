create table public.personal_assistant_history (
 id bigint generated always as identity primary key,
 employee_number text not null, request_id uuid not null,
 message text not null, reply text not null, created_at timestamptz not null default now(),
 unique(employee_number,request_id)
);
create index personal_assistant_history_page on public.personal_assistant_history(employee_number,id desc);
alter table public.personal_assistant_history enable row level security;
revoke all on public.personal_assistant_history from anon,authenticated;
create function public.personal_assistant(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text;result jsonb;
begin
 select d.employee_number into actor from public.device_identities d join public.authorized_users u using(employee_number) where d.auth_user_id=auth.uid() and u.active;
 if actor is null or actor is distinct from p_payload->>'employee' then raise exception 'Entre novamente para abrir seu assistente';end if;
 if p_action='append' then
  if length(coalesce(p_payload->>'message',''))>8000 or length(coalesce(p_payload->>'reply',''))>32000 or trim(coalesce(p_payload->>'reply',''))='' then raise exception 'Mensagem inválida';end if;
  insert into public.personal_assistant_history(employee_number,request_id,message,reply) values(actor,(p_payload->>'requestId')::uuid,coalesce(p_payload->>'message',''),p_payload->>'reply') on conflict(employee_number,request_id) do nothing;
  select to_jsonb(h) into result from public.personal_assistant_history h where employee_number=actor and request_id=(p_payload->>'requestId')::uuid;return result;
 elsif p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select * from public.personal_assistant_history where employee_number=actor and (nullif(p_payload->>'before','') is null or id<(p_payload->>'before')::bigint) order by id desc limit 50) t);
 end if;
 raise exception 'Ação inválida';
end $$;
revoke all on function public.personal_assistant(text,jsonb) from public,anon;
grant execute on function public.personal_assistant(text,jsonb) to authenticated;
