CREATE OR REPLACE FUNCTION public.configure_maintenance_operation(p_post_id text, p_plan jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.device_identities; role_name text; f jsonb; p public.operational_wall_posts; patch jsonb; key text;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in ('coordination','admin','app_manager') then raise exception 'Sem permissão para programar a atividade';end if;
 select * into p from public.operational_wall_posts where id=p_post_id;
 if p.id is null then raise exception 'Atividade não encontrada';end if;
 if role_name not in ('coordination','admin','app_manager','maintenance_director','maintenance_manager') and p.base<>coalesce(d.assigned_base,'') then raise exception 'Atividade fora da base';end if;
 perform 1 from public.shared_app_state where id='main' for update;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'maintenancePostId'=p_post_id and (not(p_plan?'flightId') or value->>'id'=p_plan->>'flightId');
 if f is null then return;end if;
 patch:='{}';
 foreach key in array array['date','departure','spot','crewRequirement','commander','copilot'] loop if p_plan?key then patch:=patch||jsonb_build_object(key,trim(coalesce(p_plan->>key,'')));end if;end loop;
 if patch?'date' then perform (patch->>'date')::date;end if;
 if patch?'departure' and patch->>'departure' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido';end if;
 foreach key in array array['commander','copilot'] loop if nullif(patch->>key,'') is not null and not exists(select 1 from public.authorized_users where employee_number=patch->>key and active and job_role in('commander','copilot')) then raise exception 'Tripulante inválido';end if;end loop;
 if f->>'operationStartedAt' is not null and ((patch?'date' and patch->>'date'<>f->>'date') or (patch?'commander' and patch->>'commander'<>f->>'commander') or (patch?'copilot' and patch->>'copilot'<>f->>'copilot')) then raise exception 'Operação iniciada: mantenha data e tripulação';end if;
 patch:=patch||jsonb_build_object('updatedBy',d.employee_number,'revision',coalesce((f->>'revision')::int,0)+1);
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=f->>'id' then value||patch else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';
end $function$;

CREATE OR REPLACE FUNCTION public.create_maintenance_request(p_record_id uuid, p_category text, p_title text, p_assigned_to text[], p_tc text, p_plan jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_post_id text; media jsonb;
begin
 v_post_id:=public.create_wall_action_from_maintenance_record(p_record_id,p_category,p_title,p_assigned_to,null,p_tc);

 media:=coalesce(nullif(p_plan->>'attachments','')::jsonb,'[]'::jsonb);
 if jsonb_typeof(media)<>'array' then raise exception 'Anexos inválidos';end if;
 if jsonb_array_length(media)>0 then
  if exists(select 1 from jsonb_array_elements(media) a where coalesce(a->>'bucket','')<>'record-media' or split_part(a->>'url','/',1)<>'maintenance' or split_part(a->>'url','/',2)<>p_record_id::text or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo fora do registro';end if;
  update public.operational_wall_posts set data=jsonb_set(data,'{attachments}',media),revision=revision+1 where operational_wall_posts.id=v_post_id;
  update public.maintenance_records set data=jsonb_set(data,'{entries}',(select jsonb_agg(case when e->>'wallPostId'=v_post_id then e||jsonb_build_object('attachments',media) else e end order by n) from jsonb_array_elements(data->'entries') with ordinality t(e,n))),revision=revision+1 where maintenance_records.id=p_record_id;
 end if;
 return v_post_id;
end $function$;

CREATE OR REPLACE FUNCTION public.create_scoped_activity(p_id text, p_base text, p_scope text, p_prefix text, p_fleet text, p_record_id uuid, p_category text, p_title text, p_tc text, p_assigned text[], p_priority text, p_plan jsonb, p_attachments jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.device_identities; role_name text; origin public.maintenance_records; targets jsonb; plane jsonb; actions jsonb:='[]'; action_id text; payload jsonb; child_id text; child_index int:=0; stamp text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 select * into actor from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=actor.employee_number and active;
 if coalesce(role_name,'') not in('admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Somente liderança e inspetoria podem criar atividades';end if;
 if nullif(trim(p_base),'') is null or (role_name not in('admin','app_manager','maintenance_director','maintenance_manager') and p_base is distinct from actor.assigned_base) then raise exception 'Base não permitida';end if;
 if p_scope not in('prefix','fleet','base','none') or p_category not in('Giro em baixa','Giro em alta','Voo de vibração','Voo de manutenção','Power Check','Lavagem da CT disk','Lavagem com produto','Procedimentos') or nullif(trim(p_title),'') is null then raise exception 'Informe alcance, tipo e finalidade válidos';end if;
 if p_scope='none' and p_category<>'Procedimentos' then raise exception 'Esta ação exige aeronave. Use Procedimentos para uma atividade geral';end if;
 if p_priority not in('routine','priority','urgent','critical') then raise exception 'Prioridade inválida';end if;
 if exists(select 1 from unnest(coalesce(p_assigned,'{}')) e where not exists(select 1 from public.authorized_users u where u.employee_number=e and u.active and u.job_role='mechanic' and u.assigned_base=p_base)) then raise exception 'Executante fora da base ou não habilitado';end if;
 if jsonb_typeof(p_attachments)<>'array' or exists(select 1 from jsonb_array_elements(p_attachments) a where a->>'bucket'<>'record-media' or split_part(a->>'url','/',1)<>'wall' or split_part(a->>'url','/',2)<>p_id or split_part(a->>'url','/',3)<>auth.uid()::text) then raise exception 'Anexo inválido';end if;
 if exists(select 1 from public.operational_wall_posts where id=p_id) then
  if exists(select 1 from public.operational_wall_posts where id=p_id and data->>'createdBy'=actor.employee_number) then return p_id;end if;raise exception 'Identificador já utilizado';
 end if;
 if p_record_id is not null then select * into origin from public.maintenance_records where id=p_record_id;if origin.id is null or origin.base<>p_base or p_scope<>'prefix' or origin.prefix<>p_prefix then raise exception 'Registro incompatível com a aeronave';end if;end if;
 select coalesce(jsonb_agg(a),'[]') into targets from public.shared_app_state s,jsonb_array_elements(s.catalogs->'aircraft') a where s.id='main' and a->>'base'=p_base and (p_scope='base' or p_scope='prefix' and a->>'prefix'=p_prefix or p_scope='fleet' and a->>'model'=p_fleet) and (p_category<>'Lavagem da CT disk' or regexp_replace(upper(a->>'model'),'[^A-Z0-9]','','g')<>'S92');
 if p_scope='none' then targets:='[{"prefix":""}]';elsif jsonb_array_length(targets)=0 then raise exception 'Nenhuma aeronave aplicável ao alcance escolhido';end if;
 for plane in select value from jsonb_array_elements(targets) loop
 action_id:=gen_random_uuid()::text;
 actions:=actions||jsonb_build_array(jsonb_build_object('id',action_id,'prefix',plane->>'prefix','title',trim(p_title),'description',coalesce(origin.title,''),'assignedTo',array_to_string(coalesce(p_assigned,'{}'),', '),'status','pending','views','[]'::jsonb,'acknowledgements','[]'::jsonb,'executions','[]'::jsonb,'createdAt',stamp));
 end loop;
 payload:=jsonb_build_object('id',p_id,'title',trim(p_title),'body',coalesce(origin.title,trim(p_title)),'category',p_category,'base',p_base,'audienceArea','maintenance','priority',p_priority,'pinned',false,'essential',false,'resolved',false,'createdBy',actor.employee_number,'createdAt',stamp,'updatedAt',stamp,'revision',1,'attachments',coalesce(p_attachments,'[]'),'views','[]'::jsonb,'acknowledgements','[]'::jsonb,'comments','[]'::jsonb,'history',jsonb_build_array(jsonb_build_object('employeeNumber',actor.employee_number,'at',stamp,'event','Criou atividade')),'actions',actions,'tc',p_tc,'scope',p_scope,'scopeFleet',p_fleet);
 if origin.id is not null then payload:=payload||jsonb_build_object('maintenanceRecordId',origin.id);end if;
 for plane in select value from jsonb_array_elements(actions) loop
 child_id:=case when child_index=0 then p_id else p_id||'-'||child_index end;child_index:=child_index+1;
 insert into public.operational_wall_posts(id,base,audience_area,pinned,essential,resolved,data) values(child_id,p_base,'maintenance',false,false,false,payload||jsonb_build_object('id',child_id,'activityGroupId',p_id,'actions',jsonb_build_array(plane)));

 end loop;
 if origin.id is not null then update public.maintenance_records set data=jsonb_set(data,'{entries}',coalesce(data->'entries','[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','assignment','description','Gerou ação pendente: '||p_category||' — '||trim(p_title),'employeeNumber',actor.employee_number,'at',stamp,'wallPostId',p_id,'assignedTo',to_jsonb(p_assigned),'attachments',coalesce(p_attachments,'[]'::jsonb)))),revision=revision+1,updated_at=now() where id=origin.id;end if;
 return p_id;
end $function$;
