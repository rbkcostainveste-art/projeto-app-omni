create or replace function public.get_flight_position(p_flight_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; rec public.flight_position_confirmations; reason text:='';
begin
 f:=private.operation_flight(p_flight_id);
 select * into rec from public.flight_position_confirmations where flight_id=p_flight_id;
 if nullif(f->>'maintenancePostId','') is null and nullif(f->>'compressorDryingTaskId','') is null and coalesce(f->>'engineStart','')<>'ok' and coalesce(f->>'shutdown','')<>'ok' then
  if exists(select 1 from public.operational_wall_posts p,jsonb_array_elements(coalesce(p.data->'actions','[]')) a where a->>'prefix'=f->>'prefix' and p.data->>'category' in('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção') and coalesce(p.data->>'resolved','false')<>'true' and a->>'status' not in('satisfactory','resolved')) then reason:='Aguardando voo/giro de manutenção';
  elsif exists(select 1 from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') a where s.id='main' and a->>'prefix'=f->>'prefix' and a->>'available'='false') then reason:='Aguardando liberação da manutenção';end if;
 end if;
 return jsonb_build_object('spot',coalesce(f->>'spot',''),'confirmed',coalesce(rec.spot=coalesce(f->>'spot','') and rec.confirmed,false),'actor',rec.actor,'name',rec.actor_name,'at',rec.marked_at,'history',coalesce(rec.history,'[]'),'waiting',reason);
end $$;
