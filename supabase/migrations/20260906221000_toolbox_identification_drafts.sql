create table public.toolbox_identification_drafts(id uuid primary key,box_id uuid not null references public.toolboxes(id),drawer_id text not null,result jsonb not null,created_by text not null,created_at timestamptz not null default now());
alter table public.toolbox_identification_drafts enable row level security;
revoke all on public.toolbox_identification_drafts from public,anon,authenticated;
create function public.save_toolbox_identification(p_id uuid,p_box_id uuid,p_drawer_id text,p_result jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.toolbox_manager_identity();
 if octet_length(p_result::text)>5000000 then raise exception 'Rascunho muito grande';end if;
 insert into public.toolbox_identification_drafts(id,box_id,drawer_id,result,created_by) values(p_id,p_box_id,p_drawer_id,p_result,actor);
end $$;
create function public.list_toolbox_identifications(p_box_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.toolbox_manager_identity();return coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from (select * from public.toolbox_identification_drafts where box_id=p_box_id order by created_at desc limit 10) d),'[]');end $$;
revoke all on function public.save_toolbox_identification(uuid,uuid,text,jsonb),public.list_toolbox_identifications(uuid) from public,anon;
grant execute on function public.save_toolbox_identification(uuid,uuid,text,jsonb),public.list_toolbox_identifications(uuid) to authenticated;
