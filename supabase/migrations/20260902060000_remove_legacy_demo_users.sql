delete from public.device_identities where employee_number in ('1024','1031','1048');
delete from public.authorized_users where employee_number in ('1024','1031','1048') and job_role='legacy';
