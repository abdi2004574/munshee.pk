-- 0015_admin_emails_rpc.sql
-- Add missing get_admin_emails RPC

create or replace function public.get_admin_emails()
returns table(email text)
language sql
stable
set search_path = public
as $$
  select trim(email) as email
  from public.app_config,
       unnest(string_to_array(value, ',')) as email
  where key = 'admin_emails';
$$;

grant execute on function public.get_admin_emails() to authenticated;
