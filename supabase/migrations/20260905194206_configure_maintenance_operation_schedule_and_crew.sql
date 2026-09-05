create or replace function public.configure_maintenance_operation(p_post_id text,p_plan jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d public.device_identities; role_name text; f jsonb; p public.operational_wall_posts; patch jsonb; key text;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();select job_role into role_name from public.authorized_users where employee_number=d.employee_number and active;
 if coalesce(role_name,'') not in ('coordination','admin','app_manager','maintenance_director','maintenance_manager','maintenance_coordinator','maintenance_leader','maintenance_inspector') then raise exception 'Sem permissão para programar a atividade';end if;
 select * into p from public.operational_wall_posts where id=p_post_id;
 if p.id is null then raise exception 'Atividade não encontrada';end if;
 if role_name not in ('coordination','admin','app_manager','maintenance_director','maintenance_manager') and p.base<>coalesce(d.assigned_base,'') then raise exception 'Atividade fora da base';end if;
 perform 1 from public.shared_app_state where id='main' for update;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'maintenancePostId'=p_post_id;
 if f is null then return;end if;
 patch:='{}';
 foreach key in array array['date','departure','spot','crewRequirement','commander','copilot'] loop if p_plan?key then patch:=patch||jsonb_build_object(key,trim(coalesce(p_plan->>key,'')));end if;end loop;
 if patch?'date' then perform (patch->>'date')::date;end if;
 if patch?'departure' and patch->>'departure' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido';end if;
 foreach key in array array['commander','copilot'] loop if nullif(patch->>key,'') is not null and not exists(select 1 from public.authorized_users where employee_number=patch->>key and active and job_role in('commander','copilot')) then raise exception 'Tripulante inválido';end if;end loop;
 if f->>'operationStartedAt' is not null and ((patch?'date' and patch->>'date'<>f->>'date') or (patch?'commander' and patch->>'commander'<>f->>'commander') or (patch?'copilot' and patch->>'copilot'<>f->>'copilot')) then raise exception 'Operação iniciada: mantenha data e tripulação';end if;
 patch:=patch||jsonb_build_object('updatedBy',d.employee_number,'revision',coalesce((f->>'revision')::int,0)+1);
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=f->>'id' then value||patch else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=now() where id='main';
end $$;
revoke all on function public.configure_maintenance_operation(text,jsonb) from public,anon;
grant execute on function public.configure_maintenance_operation(text,jsonb) to authenticated;
create or replace function public.create_maintenance_request(p_record_id uuid,p_category text,p_title text,p_assigned_to text[],p_tc text,p_plan jsonb) returns text language plpgsql security definer set search_path='' as $$
declare id text;begin
 id:=public.create_wall_action_from_maintenance_record(p_record_id,p_category,p_title,p_assigned_to,null,p_tc);
 if p_category<>'Procedimentos' then perform public.configure_maintenance_operation(id,p_plan);end if;
 return id;
end $$;
revoke all on function public.create_maintenance_request(uuid,text,text,text[],text,jsonb) from public,anon;
grant execute on function public.create_maintenance_request(uuid,text,text,text[],text,jsonb) to authenticated;
