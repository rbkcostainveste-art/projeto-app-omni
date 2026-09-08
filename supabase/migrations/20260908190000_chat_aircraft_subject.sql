alter table public.internal_conversations add column aircraft_prefix text;
create function private.chat_aircraft_context() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.record_id is not null then select prefix into new.aircraft_prefix from public.maintenance_records where id=new.record_id;
 elsif new.post_id is not null then select string_agg(distinct action->>'prefix',', ' order by action->>'prefix') into new.aircraft_prefix from public.operational_wall_posts post cross join lateral jsonb_array_elements(post.data->'actions') action where post.id=new.post_id and nullif(action->>'prefix','') is not null;
 else new.aircraft_prefix:=nullif(upper(trim(new.aircraft_prefix)),'');if new.aircraft_prefix is not null and not exists(select 1 from public.aircraft where prefix=new.aircraft_prefix) then raise exception 'Selecione uma aeronave cadastrada';end if;
 end if;return new;end $$;
revoke all on function private.chat_aircraft_context() from public,anon,authenticated;
create trigger chat_aircraft_context before insert or update of record_id,post_id,aircraft_prefix on public.internal_conversations for each row execute function private.chat_aircraft_context();
update public.internal_conversations set aircraft_prefix=aircraft_prefix where record_id is not null or post_id is not null;
do $$ declare definition text;begin
 select pg_get_functiondef('public.internal_chat(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'internal_conversations(id,title,post_id,created_by) values','internal_conversations(id,title,post_id,created_by,aircraft_prefix) values');
 definition:=replace(definition,',pid,actor);',',pid,actor,p_payload->>''aircraftPrefix'');');
 execute definition;
end $$;
