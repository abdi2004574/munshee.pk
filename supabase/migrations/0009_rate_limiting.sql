-- 0009_rate_limiting.sql
-- Section 4.4: Per-tenant rate limiting for edge functions

create table if not exists public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  function_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_log_tenant_function_idx
  on public.rate_limit_log (tenant_id, function_name, created_at desc);

alter table public.rate_limit_log enable row level security;

create or replace function public.check_rate_limit(
  p_tenant_id uuid,
  p_function_name text,
  p_max_per_minute int default 20,
  p_max_per_hour int default 200
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count_minute int;
  v_count_hour int;
begin
  delete from public.rate_limit_log
    where created_at < now() - interval '1 hour';

  select count(*) into v_count_minute from public.rate_limit_log
    where tenant_id = p_tenant_id and function_name = p_function_name
      and created_at > now() - interval '1 minute';

  select count(*) into v_count_hour from public.rate_limit_log
    where tenant_id = p_tenant_id and function_name = p_function_name
      and created_at > now() - interval '1 hour';

  if v_count_minute >= p_max_per_minute then
    return false;
  end if;
  if v_count_hour >= p_max_per_hour then
    return false;
  end if;

  insert into public.rate_limit_log (tenant_id, function_name) values (p_tenant_id, p_function_name);
  return true;
end;
$$;

grant execute on function public.check_rate_limit(uuid, text, int, int) to authenticated;
