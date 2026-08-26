drop policy "Administrators insert operation bases" on public.operation_bases;
drop policy "Administrators update operation bases" on public.operation_bases;
drop policy "Administrators delete operation bases" on public.operation_bases;
drop policy "Administrators insert aircraft models" on public.aircraft_models;
drop policy "Administrators update aircraft models" on public.aircraft_models;
drop policy "Administrators delete aircraft models" on public.aircraft_models;
drop policy "Administrators insert aircraft" on public.aircraft;
drop policy "Administrators update aircraft" on public.aircraft;
drop policy "Administrators delete aircraft" on public.aircraft;

create policy "Administrators insert operation bases" on public.operation_bases for insert to authenticated with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update operation bases" on public.operation_bases for update to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true') with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete operation bases" on public.operation_bases for delete to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators insert aircraft models" on public.aircraft_models for insert to authenticated with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update aircraft models" on public.aircraft_models for update to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true') with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete aircraft models" on public.aircraft_models for delete to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators insert aircraft" on public.aircraft for insert to authenticated with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators update aircraft" on public.aircraft for update to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true') with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "Administrators delete aircraft" on public.aircraft for delete to authenticated using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
