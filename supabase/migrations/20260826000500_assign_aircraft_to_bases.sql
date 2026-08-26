alter table public.aircraft
  add column operation_base_id uuid references public.operation_bases(id);

update public.aircraft aircraft
set operation_base_id = bases.id
from public.operation_bases bases
where bases.name = case aircraft.prefix
  when 'PR-OMN' then 'Jacarepaguá'
  when 'PP-AZU' then 'Macaé'
  when 'PR-LFT' then 'Cabo Frio'
  else 'Jacarepaguá'
end;

alter table public.aircraft alter column operation_base_id set not null;
create index aircraft_operation_base_id_idx on public.aircraft (operation_base_id);

comment on column public.aircraft.operation_base_id is 'Base atual da aeronave; pode ser alterada sem modificar prefixo ou modelo';
