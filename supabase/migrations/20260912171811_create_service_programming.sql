begin;

create or replace function public.create_service_programming(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  actor jsonb:=private.technical_actor();
  identity public.device_identities;
  person public.authorized_users;
  aircraft_record record;
  item jsonb;
  record_id uuid;
  prefix_value text;
  title_value text;
  description_value text;
  tc_value text;
  assigned jsonb;
  attachments jsonb;
  entries jsonb;
  stamp timestamptz:=clock_timestamp();
  created integer:=0;
begin
  select * into identity
  from public.device_identities
  where auth_user_id=auth.uid();

  select * into person
  from public.authorized_users
  where employee_number=identity.employee_number and active;

  if actor is null or coalesce(actor->>'role','') not in (
    'admin','app_manager','maintenance_director','maintenance_manager',
    'maintenance_coordinator','maintenance_leader','maintenance_inspector'
  ) then
    raise exception 'Somente liderança pode programar serviços';
  end if;
  if identity.signature_verified_at is null or identity.signature_verified_at<now()-interval '1 minute' then
    raise exception 'Confirme sua assinatura';
  end if;
  if person.work_shift is null or person.work_shift not in ('day','night') or nullif(trim(person.mission),'') is null then
    raise exception 'Defina turno e missão na escala antes de programar serviços';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception 'Lista de serviços inválida';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Envie de 1 a 100 serviços';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) value where jsonb_typeof(value)<>'object') then
    raise exception 'Serviço inválido';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then
    raise exception 'Há serviços duplicados no lote';
  end if;

  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    begin
      record_id:=(item->>'id')::uuid;
    exception when others then
      raise exception 'Identificador de serviço inválido';
    end;
    if record_id is null or exists(select 1 from public.maintenance_records where id=record_id) then
      raise exception 'Serviço já publicado ou sem identificador';
    end if;

    prefix_value:=upper(trim(coalesce(item->>'prefix','')));
    title_value:=trim(coalesce(item->>'title',''));
    description_value:=trim(coalesce(item->>'description',''));
    tc_value:=nullif(trim(coalesce(item->>'tc','')),'');
    assigned:=coalesce(item->'assignedTo','[]'::jsonb);
    attachments:=coalesce(item->'attachments','[]'::jsonb);

    if prefix_value='' or length(prefix_value)>24 then raise exception 'Prefixo inválido';end if;
    if title_value='' or length(title_value)>160 then raise exception 'Informe um título válido';end if;
    if description_value='' or length(description_value)>12000 then raise exception 'Informe uma descrição válida';end if;
    if length(coalesce(tc_value,''))>160 then raise exception 'Número da TC acima do limite';end if;
    if jsonb_typeof(assigned)<>'array' then
      raise exception 'Lista de executantes inválida';
    end if;
    if exists(select 1 from jsonb_array_elements(assigned) value where jsonb_typeof(value)<>'string')
      or jsonb_array_length(assigned)>100 then
      raise exception 'Lista de executantes inválida';
    end if;
    if jsonb_typeof(attachments)<>'array' then
      raise exception 'Lista de anexos inválida';
    end if;
    if jsonb_array_length(attachments)>20 or length(attachments::text)>100000 then
      raise exception 'Lista de anexos inválida';
    end if;

    select ac.prefix,models.name as model,bases.name as base
    into aircraft_record
    from public.aircraft ac
    join public.aircraft_models models on models.id=ac.model_id
    join public.operation_bases bases on bases.id=ac.operation_base_id
    where upper(ac.prefix)=prefix_value and ac.active;
    if aircraft_record.prefix is null then raise exception 'Aeronave não encontrada ou inativa: %',prefix_value;end if;
    if actor->>'role' not in ('admin','app_manager','maintenance_director','maintenance_manager')
      and aircraft_record.base is distinct from coalesce(actor->>'base','') then
      raise exception 'Aeronave fora da sua base: %',prefix_value;
    end if;
    if exists(
      select 1
      from jsonb_array_elements_text(assigned) employee
      where not exists(
        select 1 from public.authorized_users candidate
        where candidate.employee_number=employee
          and candidate.active
          and candidate.assigned_base=aircraft_record.base
          and coalesce(candidate.job_role,candidate.access_profile) in (
            'mechanic','maintenance_assistant','maintenance_director','maintenance_manager',
            'maintenance_coordinator','maintenance_leader','maintenance_inspector'
          )
      )
    ) then
      raise exception 'Selecione executantes ativos da base de cada tarefa';
    end if;

    entries:=case when jsonb_array_length(assigned)>0 then jsonb_build_array(jsonb_build_object(
      'id',gen_random_uuid(),'kind','assignment','description','Designado para '||
      (select string_agg(value,', ' order by value) from jsonb_array_elements_text(assigned) value),
      'assignedTo',assigned,'employeeNumber',actor->>'employee','at',stamp
    )) else '[]'::jsonb end;

    insert into public.maintenance_records(
      id,record_type,base,model,prefix,priority,status,title,tc,created_by,data
    ) values (
      record_id,'inspection',aircraft_record.base,aircraft_record.model,aircraft_record.prefix,
      'routine','open',title_value,tc_value,actor->>'employee',
      jsonb_build_object(
        'description',description_value,
        'assignedTo',assigned,
        'attachments',attachments,
        'links','[]'::jsonb,
        'entries',entries,
        'originShift',person.work_shift,
        'originMission',person.mission,
        'createdBy',actor->>'employee',
        'createdAt',stamp,
        'updatedAt',stamp,
        'revision',1
      )
    );
    created:=created+1;
  end loop;
  return created;
end
$$;

revoke all on function public.create_service_programming(jsonb) from public,anon;
grant execute on function public.create_service_programming(jsonb) to authenticated;

commit;
