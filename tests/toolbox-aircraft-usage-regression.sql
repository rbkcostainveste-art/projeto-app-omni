-- Every fixture and role change is rolled back; no operational records persist.
begin;
do $test$
declare keeper public.device_identities; owner_d public.device_identities; borrower public.device_identities; outsider text; b uuid; o uuid; e uuid; blocked boolean; first_prefix text; next_prefix text;
begin
 select * into keeper from public.device_identities where coalesce(job_role,access_profile)='toolroom' limit 1;
 select * into owner_d from public.device_identities where coalesce(job_role,access_profile)='mechanic' limit 1;
 select * into borrower from public.device_identities where coalesce(job_role,access_profile)='mechanic' and employee_number<>owner_d.employee_number limit 1;
 select employee_number into outsider from public.authorized_users where active and coalesce(job_role,access_profile) in('commander','copilot','coordination') limit 1;
 select prefix into first_prefix from public.aircraft order by prefix limit 1;
 select prefix into next_prefix from public.aircraft where prefix<>first_prefix order by prefix limit 1;
 if keeper.auth_user_id is null or owner_d.auth_user_id is null or borrower.auth_user_id is null or outsider is null or next_prefix is null then raise exception 'Missing test identities/aircraft';end if;
 perform set_config('request.jwt.claim.sub',keeper.auth_user_id::text,true);
 b:=public.create_toolbox_catalog('QA aircraft usage '||gen_random_uuid(),'Jacarepaguá');
 perform public.save_toolbox_visual(b,'[{"id":"g1","name":"Gaveta 1","reviewed":true,"tools":[{"id":"t1","name":"Soquete","measure":"10 mm","reviewed":true},{"id":"t2","name":"Soquete","measure":"12 mm","reviewed":true}]}]',0);
 blocked:=false;begin perform public.toolbox_command('assign_box',jsonb_build_object('boxId',b,'assignedTo',outsider));exception when others then blocked:=true;end;if not blocked then raise exception 'Non-maintenance recipient accepted';end if;
 blocked:=false;begin perform public.toolbox_command('assign_box',jsonb_build_object('boxId',b,'assignedTo',keeper.employee_number));exception when others then blocked:=true;end;if not blocked then raise exception 'Toolroom recipient accepted';end if;
 -- An auxiliary must have the same borrowing/receiving capability as maintenance.
 update public.authorized_users set job_role='maintenance_assistant' where employee_number=owner_d.employee_number;
 update public.device_identities set job_role='maintenance_assistant' where employee_number=owner_d.employee_number;
 o:=(public.toolbox_command('assign_box',jsonb_build_object('boxId',b,'assignedTo',owner_d.employee_number,'aircraftPrefix',first_prefix))->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',owner_d.auth_user_id::text,true);
 perform public.toolbox_command('accept_box',jsonb_build_object('operationId',o));
 e:=(public.toolbox_command('take_tool',jsonb_build_object('boxId',b,'aircraftPrefix',next_prefix,'toolIds','["t1"]'::jsonb))->>'id')::uuid;
 if not exists(select 1 from public.toolbox_events where id=e and status='open' and approved_by=owner_d.employee_number and aircraft_prefix=next_prefix and tool_refs->0->>'drawer'='Gaveta 1') then raise exception 'Self-use missing approval, aircraft or drawer snapshot';end if;
 if not exists(select 1 from public.toolbox_audit where target_id=e and action='self_tool_use' and actor=owner_d.employee_number) then raise exception 'Missing self-use signature';end if;
 perform public.toolbox_command('change_box_aircraft',jsonb_build_object('operationId',o,'previousPrefix',first_prefix,'aircraftPrefix',next_prefix));
 if not exists(select 1 from public.toolbox_operations where id=o and aircraft_prefix=next_prefix and aircraft_usage->0->>'to'=first_prefix and aircraft_usage->1->>'from'=first_prefix and aircraft_usage->1->>'to'=next_prefix and aircraft_usage->1->>'actor'=owner_d.employee_number) then raise exception 'Usage chain not preserved';end if;
 if not exists(select 1 from public.toolbox_audit where target_id=o and action='change_box_aircraft' and payload->>'from'=first_prefix) then raise exception 'Missing signed change audit';end if;
 blocked:=false;begin perform public.toolbox_command('change_box_aircraft',jsonb_build_object('operationId',o,'previousPrefix',first_prefix,'aircraftPrefix',first_prefix));exception when others then blocked:=true;end;if not blocked then raise exception 'Stale change accepted';end if;
 perform set_config('request.jwt.claim.sub',borrower.auth_user_id::text,true);
 blocked:=false;begin perform public.toolbox_command('change_box_aircraft',jsonb_build_object('operationId',o,'previousPrefix',next_prefix,'aircraftPrefix',first_prefix));exception when others then blocked:=true;end;if not blocked then raise exception 'Unrelated person changed box aircraft';end if;
 blocked:=false;begin perform public.toolbox_command('take_tool',jsonb_build_object('boxId',b,'aircraftPrefix',first_prefix,'toolIds','["t1"]'::jsonb));exception when others then blocked:=true;end;if not blocked then raise exception 'Busy tool borrowed twice';end if;
 e:=(public.toolbox_command('take_tool',jsonb_build_object('boxId',b,'aircraftPrefix',first_prefix,'toolIds','["t2"]'::jsonb))->>'id')::uuid;
 if (select status from public.toolbox_events where id=e)<>'awaiting_approval' then raise exception 'Colleague bypassed owner confirmation';end if;
 perform set_config('request.jwt.claim.sub',owner_d.auth_user_id::text,true);
 perform public.toolbox_command('change_box_aircraft',jsonb_build_object('operationId',o,'previousPrefix',next_prefix,'aircraftPrefix',first_prefix));
 if (select aircraft_prefix from public.toolbox_events where operation_id=o and tool_refs->0->>'id'='t1')<>next_prefix then raise exception 'Changing box overwrote past tool use';end if;
 perform public.toolbox_command('approve_tool_withdrawal',jsonb_build_object('eventId',e));
 perform set_config('request.jwt.claim.sub',keeper.auth_user_id::text,true);
 blocked:=false;begin perform public.toolbox_command('request_box_return',jsonb_build_object('operationId',o));exception when others then blocked:=true;end;if not blocked then raise exception 'Box returned with tools outstanding';end if;
end $test$;
rollback;
select 'PASS: maintenance-only recipients including auxiliary; self-use signature; immutable aircraft usage; owner-only changes; stale edits; no double loans; colleague confirmation; outstanding tools block return' as result;
