-- Keep the wall's source-report copy aligned with the approved record.
create or replace function private.current_report_wall_text(p jsonb, prefix text, title text, description text)
returns jsonb language sql immutable set search_path='' as $$
 select case when jsonb_array_length(coalesce(p->'actions','[]'))=0
 then p||jsonb_build_object('title','Relato Técnico · '||prefix||' · '||title,'body',coalesce(description,'')) else p end
$$;
revoke all on function private.current_report_wall_text(jsonb,text,text,text) from public,anon,authenticated;
create or replace function private.sync_report_wall_text() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.operational_wall_posts w set data=private.current_report_wall_text(w.data,new.prefix,new.title,new.data->>'description'),revision=w.revision+1,updated_at=clock_timestamp()
 where w.data->>'maintenanceRecordId'=new.id::text and jsonb_array_length(coalesce(w.data->'actions','[]'))=0
 and w.data is distinct from private.current_report_wall_text(w.data,new.prefix,new.title,new.data->>'description');
 return new;
end $$;
revoke all on function private.sync_report_wall_text() from public,anon,authenticated;
create trigger sync_report_wall_text after update of title,data on public.maintenance_records for each row execute function private.sync_report_wall_text();
-- Transactional backfill: table lock prevents concurrent writes; restore the access trigger before commit.
alter table public.operational_wall_posts disable trigger enforce_wall_area_access;
update public.operational_wall_posts w set data=private.current_report_wall_text(w.data,r.prefix,r.title,r.data->>'description'),revision=w.revision+1
from public.maintenance_records r where w.data->>'maintenanceRecordId'=r.id::text and jsonb_array_length(coalesce(w.data->'actions','[]'))=0
and w.data is distinct from private.current_report_wall_text(w.data,r.prefix,r.title,r.data->>'description');
alter table public.operational_wall_posts enable trigger enforce_wall_area_access;

-- Closing the report remains available after its individual tasks have been closed.
create or replace function public.close_maintenance_record(p_record_id uuid,p_expected_revision bigint,p_reason text,p_closure jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.maintenance_records; c jsonb;
begin
 if not coalesce(private.technical_allowed('close'),false) then raise exception 'Sem autorização para encerrar relatos';end if;
 if not exists(select 1 from public.device_identities where auth_user_id=auth.uid() and signature_verified_at>now()-interval '1 minute') then raise exception 'Confirme sua senha para assinar o encerramento';end if;
 select * into r from public.maintenance_records where id=p_record_id;
 if r.id is null or not coalesce(private.technical_access(r),false) then raise exception 'Relato indisponível para seu perfil/base';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.prefix,83642));
 select * into r from public.maintenance_records where id=p_record_id for update;
 if r.revision<>p_expected_revision then raise exception 'Relato atualizado. Reabra antes de confirmar';end if;
 if r.technical_case->>'investigation'='closed' then raise exception 'Relato já encerrado';end if;
 if nullif(trim(p_reason),'') is null or not coalesce((p_closure->>'confirmed')::boolean,false) then raise exception 'Informe a conclusão e confirme o encerramento';end if;
 if exists(select 1 from public.operational_wall_posts w cross join lateral jsonb_array_elements(coalesce(w.data->'actions','[]')) a where w.data->>'maintenanceRecordId'=r.id::text and a->>'status' is distinct from 'resolved') then raise exception 'Encerre as ações vinculadas antes de encerrar o relato';end if;
 c:=r.technical_case||jsonb_build_object('investigation','closed','aircraft','released','reason',trim(p_reason));
 if nullif(trim(p_closure->>'aprsRef'),'') is not null then c:=c||jsonb_build_object('aprsRef',trim(p_closure->>'aprsRef'),'confirmAprs',true);end if;
 if nullif(trim(p_closure->>'officialId'),'') is not null then c:=c||jsonb_build_object('official','linked','officialId',trim(p_closure->>'officialId'));end if;
 if coalesce((p_closure->>'officialClosed')::boolean,false) then c:=c||jsonb_build_object('officialClosed',true);end if;
 return public.technical_case_action('update',r.id,jsonb_build_object('revision',r.revision,'case',c));
end $$;
revoke all on function public.close_maintenance_record(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.close_maintenance_record(uuid,bigint,text,jsonb) to authenticated;
