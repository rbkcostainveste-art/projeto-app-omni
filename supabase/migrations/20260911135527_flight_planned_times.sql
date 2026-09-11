create or replace function public.update_flight_planned_times(p_flight_id text,p_revision bigint,p_departure text,p_duration numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.device_identities; u public.authorized_users; f jsonb; updated jsonb; stamp timestamptz:=clock_timestamp(); rev bigint; fields jsonb; history jsonb;
begin
 select * into d from public.device_identities where auth_user_id=auth.uid();
 select * into u from public.authorized_users where employee_number=d.employee_number and active;
 if d.auth_user_id is null or u.employee_number is null then raise exception 'Sessão não autorizada';end if;
 if d.signature_verified_at is null or d.signature_verified_at<now()-interval '1 minute' then raise exception 'Confirme sua assinatura';end if;
 if p_departure is null or p_departure !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_duration is null or p_duration<0 or p_duration>=24 then raise exception 'Horário ou duração inválidos';end if;
 perform 1 from public.shared_app_state where id='main' for update;
 select value into f from public.shared_app_state s,jsonb_array_elements(s.flights) where s.id='main' and value->>'id'=p_flight_id;
 if f is null or coalesce(f->>'deletedAt','')<>'' then raise exception 'Voo não encontrado';end if;
 if not coalesce((d.is_admin or u.job_role in('admin','app_manager') or u.job_role='coordination' and f->>'base'=d.assigned_base or u.job_role in('commander','copilot') and d.employee_number in(f->>'commander',f->>'copilot')),false) then raise exception 'Somente a tripulação escalada e a coordenação da base editam estes horários';end if;
 if coalesce((f->>'cancelled')::boolean,false) then raise exception 'Voo cancelado';end if;
 if p_revision is null or coalesce((f->>'revision')::bigint,0)<>p_revision then raise exception 'O voo foi atualizado. Reabra antes de editar';end if;
 if f->>'departure'=p_departure and (f->>'duration')::numeric=p_duration then return f;end if;
 rev:=p_revision+1;fields:=coalesce(f->'fieldRevisions','{}');history:=coalesce(f->'history','[]');
 if f->>'departure' is distinct from p_departure then fields:=fields||jsonb_build_object('departure',rev);history:=history||jsonb_build_array(jsonb_build_object('field','departure','previousValue',f->>'departure','value',p_departure,'employeeNumber',d.employee_number,'at',stamp,'revision',rev));end if;
 if (f->>'duration')::numeric is distinct from p_duration then fields:=fields||jsonb_build_object('duration',rev);history:=history||jsonb_build_array(jsonb_build_object('field','duration','previousValue',f->>'duration','value',p_duration::text,'employeeNumber',d.employee_number,'at',stamp,'revision',rev));end if;
 updated:=f||jsonb_build_object('departure',p_departure,'duration',p_duration,'revision',rev,'fieldRevisions',fields,'history',history,'updatedBy',d.employee_number,'acknowledged',coalesce(f->'acknowledged','{}')||jsonb_build_object(d.employee_number,rev),'actionBy',coalesce(f->'actionBy','{}')||jsonb_build_object('departure',d.employee_number,'duration',d.employee_number));
 update public.shared_app_state set flights=(select jsonb_agg(case when value->>'id'=p_flight_id then updated else value end order by n) from jsonb_array_elements(flights) with ordinality t(value,n)),revision=revision+1,updated_at=stamp where id='main';
 return updated;
end $$;
revoke all on function public.update_flight_planned_times(text,bigint,text,numeric) from public,anon;
grant execute on function public.update_flight_planned_times(text,bigint,text,numeric) to authenticated;
