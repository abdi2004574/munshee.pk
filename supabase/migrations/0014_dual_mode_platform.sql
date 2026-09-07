-- 0014_dual_mode_platform.sql
-- Dual-mode platform foundation: self-serve merchants + experts serving clients
-- 3-tier billing: free / starter / business
-- Append-only: does not modify existing data, only adds new tables/columns/functions.

-- ============================================================================
-- 1. app_config table (for admin email config and other app-level settings)
-- ============================================================================

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

insert into public.app_config (key, value)
  values ('admin_emails', 'admin@munshee.pk')
  on conflict (key) do nothing;

-- ============================================================================
-- 2. plans table (seeded: free, starter, business)
-- ============================================================================

create table if not exists public.plans (
  id            text primary key,  -- 'free', 'starter', 'business'
  name          text not null,
  price_pkr     int not null,
  actions_monthly int not null,
  max_businesses int not null,
  features      jsonb not null default '{}'::jsonb,
  sort_order    int not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists plans_sort_order_idx on public.plans (sort_order);

-- Upsert plans (idempotent)
insert into public.plans (id, name, price_pkr, actions_monthly, max_businesses, features, sort_order) values
  ('free', 'Free', 0, 50, 1,
    jsonb_build_object(
      'watermark', true,
      'ask_munshee', false,
      'wa_export_analysis', false,
      'voice_digest', false,
      'client_switcher', false,
      'reporting_export', false,
      'directory_eligible', false
    ), 1),
  ('starter', 'Starter', 5000, 600, 1,
    jsonb_build_object(
      'watermark', false,
      'ask_munshee', true,
      'wa_export_analysis', true,
      'voice_digest', true,
      'client_switcher', false,
      'reporting_export', true,
      'directory_eligible', true
    ), 2),
  ('business', 'Business', 9000, 2500, 6,
    jsonb_build_object(
      'watermark', false,
      'ask_munshee', true,
      'wa_export_analysis', true,
      'voice_digest', true,
      'client_switcher', true,
      'reporting_export', true,
      'directory_eligible', true
    ), 3)
on conflict (id) do update set
  name = excluded.name,
  price_pkr = excluded.price_pkr,
  actions_monthly = excluded.actions_monthly,
  max_businesses = excluded.max_businesses,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ============================================================================
-- 3. profiles.role column
-- ============================================================================

alter table public.profiles
  add column if not exists role text not null default 'merchant'
  check (role in ('merchant', 'expert', 'both'));

-- ============================================================================
-- 4. businesses.managed_by column
-- ============================================================================

alter table public.businesses
  add column if not exists managed_by uuid references public.profiles(id);

create index if not exists businesses_managed_by_idx on public.businesses (managed_by);

-- ============================================================================
-- 5. subscriptions table
-- ============================================================================
-- In this codebase, tenants.id = auth.uid() = the business identity.
-- subscriptions.business_id references tenants(id), mapping to the task's
-- "business_id (FK to businesses)" concept: tenants ARE the business accounts.

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.tenants(id) on delete cascade,
  plan_id         text not null references public.plans(id),
  status          text not null default 'trial'
                    check (status in ('active', 'pending_payment', 'expired', 'trial')),
  period_start    timestamptz,
  period_end      timestamptz,
  admin_granted   boolean not null default false,
  actions_remaining int not null default 0,
  last_grant_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists subscriptions_business_id_unique
  on public.subscriptions (business_id);

create index if not exists subscriptions_plan_idx
  on public.subscriptions (plan_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

-- ============================================================================
-- 6. experts table
-- ============================================================================

create table if not exists public.experts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  display_name  text not null,
  city          text,
  specialties   text[],
  certification text not null default 'none'
    check (certification in ('none', 'verified')),
  rating        numeric(3,2) default 0,
  referral_code text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists experts_user_id_unique
  on public.experts (user_id);

create unique index if not exists experts_referral_code_unique
  on public.experts (referral_code)
  where referral_code is not null;

create index if not exists experts_referral_code_idx
  on public.experts (referral_code);

-- ============================================================================
-- 7. referrals table
-- ============================================================================

create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_expert_id uuid not null references public.experts(id) on delete cascade,
  referred_user_id   uuid not null references public.profiles(id) on delete cascade,
  status            text not null default 'signed_up',
  commission_status text not null default 'pending',
  created_at        timestamptz not null default now()
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_expert_id);

create index if not exists referrals_referred_user_idx
  on public.referrals (referred_user_id);

create unique index if not exists referrals_unique_pair
  on public.referrals (referrer_expert_id, referred_user_id);

-- ============================================================================
-- 8. action_usage_log table (action-based metering, wired to credit_ledger)
-- ============================================================================

create table if not exists public.action_usage_log (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.tenants(id) on delete cascade,
  action_type  text not null,
  actions_left int not null,
  created_at   timestamptz not null default now()
);

create index if not exists action_usage_log_business_idx
  on public.action_usage_log (business_id, created_at desc);

-- ============================================================================
-- 9. admin_audit_log table
-- ============================================================================

create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  action        text not null,
  target_id     uuid,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log (admin_user_id, created_at desc);

-- ============================================================================
-- 10. is_admin() function
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.jwt() ->> 'email' = any (
    select unnest(string_to_array(value, ','))
    from public.app_config
    where key = 'admin_emails'
  );
$$;

-- ============================================================================
-- 11. RLS policies
-- ============================================================================

-- Plans: public read
alter table public.plans enable row level security;
create policy "plans_public_read" on public.plans
  for select using (true);
grant select on public.plans to anon, authenticated;

-- Subscriptions: scoped to business_id = auth.uid(), admins bypass
alter table public.subscriptions enable row level security;

create policy "subscriptions_owner_select" on public.subscriptions
  for select using (
    business_id = auth.uid() or public.is_admin()
  );
create policy "subscriptions_owner_insert" on public.subscriptions
  for insert with check (
    business_id = auth.uid() or public.is_admin()
  );
create policy "subscriptions_owner_update" on public.subscriptions
  for update using (
    business_id = auth.uid() or public.is_admin()
  );
create policy "subscriptions_owner_delete" on public.subscriptions
  for delete using (
    business_id = auth.uid() or public.is_admin()
  );
grant select, insert, update, delete on public.subscriptions to authenticated;

-- Experts: public read on view (display fields only), owner update on table
alter table public.experts enable row level security;

create policy "experts_owner_all" on public.experts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.experts to authenticated;

-- Public view of experts (display fields only)
create or replace view public.experts_public
as
  select id, display_name, city, specialties, certification, rating, referral_code
  from public.experts
  where certification in ('none', 'verified');

grant select on public.experts_public to anon, authenticated;

-- Referrals: owner (referrer) read
alter table public.referrals enable row level security;

create policy "referrals_owner_select" on public.referrals
  for select using (
    exists (
      select 1 from public.experts e
      where e.id = referrals.referrer_expert_id
        and e.user_id = auth.uid()
    )
    or public.is_admin()
  );
create policy "referrals_owner_insert" on public.referrals
  for insert with check (
    exists (
      select 1 from public.experts e
      where e.id = referrals.referrer_expert_id
        and e.user_id = auth.uid()
    )
    or public.is_admin()
  );
grant select, insert on public.referrals to authenticated;

-- action_usage_log: scoped to business_id = auth.uid()
alter table public.action_usage_log enable row level security;

create policy "action_usage_log_owner_select" on public.action_usage_log
  for select using (
    business_id = auth.uid() or public.is_admin()
  );
create policy "action_usage_log_owner_insert" on public.action_usage_log
  for insert with check (
    business_id = auth.uid() or public.is_admin()
  );
grant select, insert on public.action_usage_log to authenticated;

-- app_config: admin only
alter table public.app_config enable row level security;

create policy "app_config_admin_select" on public.app_config
  for select using (public.is_admin());
create policy "app_config_admin_all" on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.app_config to authenticated;

-- admin_audit_log: admin only
alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_admin_select" on public.admin_audit_log
  for select using (public.is_admin());
create policy "admin_audit_log_admin_insert" on public.admin_audit_log
  for insert with check (public.is_admin());
grant select, insert on public.admin_audit_log to authenticated;

-- ============================================================================
-- 12. Updated_at triggers
-- ============================================================================

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.handle_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists experts_set_updated_at on public.experts;
create trigger experts_set_updated_at
  before update on public.experts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 13. Referral code auto-generation trigger (8-char alphanumeric)
-- ============================================================================

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempt int := 0;
  code_exists boolean;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'Failed to generate unique referral code after 10 attempts';
    end if;
    
    select exists(select 1 from public.experts where referral_code = result) into code_exists;
    if not code_exists then
      return result;
    end if;
  end loop;
end;
$$;

create or replace function public.set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists experts_set_referral_code on public.experts;
create trigger experts_set_referral_code
  before insert on public.experts
  for each row execute function public.set_referral_code();

-- ============================================================================
-- 14. consume_action RPC with lazy monthly reset
-- ============================================================================

create or replace function public.ensure_monthly_grant(p_subscription_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id    text;
  v_actions    int;
  v_last_grant timestamptz;
begin
  select s.plan_id, s.actions_remaining, s.last_grant_at
    into v_plan_id, v_actions, v_last_grant
    from public.subscriptions s
    where s.id = p_subscription_id
    for update;

  if not found then
    return 0;
  end if;

  -- Lazy monthly reset: if last grant is >30 days old, grant new allocation
  if v_last_grant is null or v_last_grant < now() - interval '30 days' then
    select actions_monthly into v_actions from public.plans where id = v_plan_id;
    if v_actions is null then
      v_actions := 0;
    end if;

    update public.subscriptions
       set actions_remaining = v_actions,
           last_grant_at = now(),
           period_start = now(),
           period_end = now() + interval '30 days'
     where id = p_subscription_id;

    return v_actions;
  end if;

  return v_actions;
end;
$$;

grant execute on function public.ensure_monthly_grant(uuid) to authenticated;

create or replace function public.ensure_monthly_grant_by_business(p_business_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
begin
  select id into v_sub_id
    from public.subscriptions
    where business_id = p_business_id
    for update;

  if v_sub_id is null then
    -- Auto-provision free plan subscription
    insert into public.subscriptions
      (business_id, plan_id, status, period_start, period_end, admin_granted, actions_remaining, last_grant_at)
    values
      (p_business_id, 'free', 'trial', now(), now() + interval '30 days', false, 50, now())
    returning id into v_sub_id;
  end if;

  return public.ensure_monthly_grant(v_sub_id);
end;
$$;

grant execute on function public.ensure_monthly_grant_by_business(uuid) to authenticated;

create or replace function public.consume_action(p_business_id uuid, p_action_type text)
returns table(ok boolean, actions_left int, subscription_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_plan_id text;
  v_remaining int;
  v_last_grant timestamptz;
  v_status text;
begin
  -- Get or create subscription
  select id, plan_id, actions_remaining, last_grant_at, status
    into v_sub_id, v_plan_id, v_remaining, v_last_grant, v_status
    from public.subscriptions
    where business_id = p_business_id
    for update;

  if v_sub_id is null then
    -- Auto-provision free plan
    insert into public.subscriptions
      (business_id, plan_id, status, period_start, period_end, admin_granted, actions_remaining, last_grant_at)
    values
      (p_business_id, 'free', 'trial', now(), now() + interval '30 days', false, 50, now())
    returning id, plan_id, actions_remaining, last_grant_at, status
      into v_sub_id, v_plan_id, v_remaining, v_last_grant, v_status;
  end if;

  -- Lazy monthly reset
  if v_last_grant is null or v_last_grant < now() - interval '30 days' then
    select actions_monthly into v_remaining
      from public.plans where id = v_plan_id;
    if v_remaining is null then
      v_remaining := 0;
    end if;

    update public.subscriptions
       set actions_remaining = v_remaining,
           last_grant_at = now(),
           period_start = now(),
            period_end = now() + interval '30 days'
     where id = v_sub_id;
  end if;

  -- Check if actions available
  if v_remaining <= 0 then
    return query select false, 0, v_status;
    return;
  end if;

  -- Decrement
  v_remaining := v_remaining - 1;
  update public.subscriptions
     set actions_remaining = v_remaining
   where id = v_sub_id;

  -- Log to action_usage_log
  insert into public.action_usage_log (business_id, action_type, actions_left)
  values (p_business_id, p_action_type, v_remaining);

  -- Also wire to existing credit_ledger for audit trail
  insert into public.credit_ledger (tenant_id, action_type, credits_used, balance_after, reference_id)
  values (p_business_id, p_action_type, 1, v_remaining, v_sub_id::text);

  return query select true, v_remaining, v_status;
end;
$$;

grant execute on function public.consume_action(uuid, text) to authenticated;

-- ============================================================================
-- 15. get_current_plan RPC (returns plan, subscription, actions_left)
-- ============================================================================

create or replace function public.get_current_plan(p_business_id uuid)
returns table(
  plan_id text,
  plan_name text,
  price_pkr int,
  actions_monthly int,
  max_businesses int,
  features jsonb,
  subscription_status text,
  actions_left int,
  period_end timestamptz,
  admin_granted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_plan_id text;
  v_actions_left int;
  v_status text;
  v_period_end timestamptz;
  v_admin_granted boolean;
  v_last_grant timestamptz;
begin
  -- Ensure grant is applied
  perform public.ensure_monthly_grant_by_business(p_business_id);

  select s.id, s.plan_id, s.actions_remaining, s.status, s.period_end, s.admin_granted
    into v_sub_id, v_plan_id, v_actions_left, v_status, v_period_end, v_admin_granted
    from public.subscriptions s
    where s.business_id = p_business_id;

  if v_sub_id is null then
    -- No subscription yet; default to free plan
    select id, name, price_pkr, actions_monthly, max_businesses, features
      into v_plan_id, plan_name, price_pkr, actions_monthly, max_businesses, features
      from public.plans where id = 'free';
    v_actions_left := 50;
    v_status := 'trial';
    v_period_end := now() + interval '30 days';
    v_admin_granted := false;
  else
    select p.name, p.price_pkr, p.actions_monthly, p.max_businesses, p.features
      into plan_name, price_pkr, actions_monthly, max_businesses, features
      from public.plans p
      where p.id = v_plan_id;
  end if;

  return query
  select v_plan_id as plan_id, plan_name, price_pkr, actions_monthly,
         max_businesses, features, v_status as subscription_status,
         v_actions_left as actions_left, v_period_end as period_end,
         v_admin_granted as admin_granted;
end;
$$;

grant execute on function public.get_current_plan(uuid) to authenticated;

-- ============================================================================
-- 16. Admin activation RPC (for admin grant flow)
-- ============================================================================

create or replace function public.admin_activate_subscription(
  p_subscription_id uuid,
  p_plan_id text,
  p_duration_days int default 30
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email text;
begin
  -- Verify caller is admin
  v_admin_email := auth.jwt() ->> 'email';
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  update public.subscriptions
     set status = 'active',
         plan_id = p_plan_id,
         period_end = now() + (p_duration_days || ' days')::interval,
         admin_granted = true,
         actions_remaining = (select actions_monthly from public.plans where id = p_plan_id),
         last_grant_at = now()
   where id = p_subscription_id;

  if not found then
    raise exception 'subscription not found';
  end if;

  insert into public.admin_audit_log (admin_user_id, action, target_id, details)
  values (auth.uid(), 'activate_subscription', p_subscription_id,
          jsonb_build_object('plan_id', p_plan_id, 'duration_days', p_duration_days));
end;
$$;

grant execute on function public.admin_activate_subscription(uuid, text, int) to authenticated;

-- ============================================================================
-- 17. Expert mode RPCs
-- ============================================================================

-- Create a client business under an expert's management
create or replace function public.create_client_business(
  p_business_name text,
  p_phone text,
  p_expert_profile_id uuid,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expert_count int;
  v_max_businesses int;
  v_tenant_id uuid;
  v_business_id uuid;
begin
  -- Verify the caller is the expert
  if p_expert_profile_id <> auth.uid() then
    raise exception 'only the expert can create client businesses';
  end if;

  -- Verify the user is an expert
  if (select role from public.profiles where id = p_expert_profile_id) not in ('expert', 'both') then
    raise exception 'user is not an expert';
  end if;

  -- Check if expert is registered
  if not exists (select 1 from public.experts where user_id = p_expert_profile_id) then
    raise exception 'expert profile not found';
  end if;

  -- Count current managed businesses
  select p.max_businesses into v_max_businesses
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.business_id = p_expert_profile_id
    and s.status in ('active', 'trial', 'pending_payment');

  if v_max_businesses is null then
    v_max_businesses := 1; -- Free plan default
  end if;

  select count(*) into v_expert_count
    from public.businesses
    where managed_by = p_expert_profile_id
    and deleted_at is null;

  if v_expert_count >= v_max_businesses then
    raise exception 'expert business limit reached (max %)', v_max_businesses;
  end if;

  -- Create tenant for the client
  insert into public.tenants (id, display_name)
  values (gen_random_uuid(), coalesce(p_display_name, p_business_name))
  returning id into v_tenant_id;

  -- Create client profile
  insert into public.profiles (id, tenant_id, full_name, role)
  values (v_tenant_id, v_tenant_id, coalesce(p_display_name, p_business_name), 'merchant');

  -- Create business row
  insert into public.businesses (tenant_id, managed_by, slug, display_name, description)
  values (v_tenant_id, p_expert_profile_id, lower(replace(coalesce(p_business_name, 'client-business') || '-' || gen_random_uuid()::text, ' ', '-')), coalesce(p_business_name, 'Client Business'), null)
  returning id into v_business_id;

  -- Auto-provision a subscription for the new business (inherits expert's plan level)
  insert into public.subscriptions (business_id, plan_id, status, period_start, period_end, admin_granted, actions_remaining, last_grant_at)
  select v_tenant_id,
         (select plan_id from public.subscriptions where business_id = p_expert_profile_id and status in ('active','trial') order by created_at desc limit 1),
         'trial', now(), now() + interval '30 days', false,
         (select actions_monthly from public.plans p join public.subscriptions s on s.plan_id = p.id where s.business_id = p_expert_profile_id limit 1),
         now();

  -- Log referral if there's a referral code context
  -- (referral tracking happens at signup via the referral_code)

  return v_business_id;
end;
$$;

grant execute on function public.create_client_business(text, text, uuid, text) to authenticated;

-- Get businesses managed by the current expert
create or replace function public.get_managed_businesses()
returns table(
  business_id uuid,
  tenant_id uuid,
  display_name text,
  slug text,
  managed_by uuid,
  actions_left int,
  subscription_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select b.id, b.tenant_id, b.display_name, b.slug, b.managed_by,
         s.actions_remaining, s.status
    from public.businesses b
    left join public.subscriptions s on s.business_id = b.tenant_id
    where b.managed_by = auth.uid()
      and b.deleted_at is null
    order by b.created_at desc;
end;
$$;

grant execute on function public.get_managed_businesses() to authenticated;

-- ============================================================================
-- 18. Record referral on signup
-- ============================================================================

create or replace function public.record_referral_signup(p_profile_id uuid, p_referral_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expert_id uuid;
begin
  if p_referral_code is null or p_referral_code = '' then
    return;
  end if;

  select id into v_expert_id
    from public.experts
    where referral_code = p_referral_code;

  if v_expert_id is null then
    return;
  end if;

  insert into public.referrals (referrer_expert_id, referred_user_id)
  values (v_expert_id, p_profile_id)
  on conflict (referrer_expert_id, referred_user_id) do nothing;
end;
$$;

grant execute on function public.record_referral_signup(uuid, text) to authenticated;

-- ============================================================================
-- 19. Feature flag helper RPC for frontend
-- ============================================================================

create or replace function public.get_feature_flags(p_business_id uuid)
returns table(
  plan_id text,
  plan_name text,
  features jsonb,
  actions_left int,
  subscription_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select p.id, p.name, p.features, s.actions_remaining, s.status
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.business_id = p_business_id
    for update;
end;
$$;

grant execute on function public.get_feature_flags(uuid) to authenticated;

-- ============================================================================
-- 20. Grants
-- ============================================================================

grant usage on schema public to authenticated, anon;
grant select on public.plans to anon, authenticated;
grant select on public.experts_public to anon, authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.experts to authenticated;
grant select, insert on public.referrals to authenticated;
grant select, insert on public.action_usage_log to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant select, insert, update, delete on public.app_config to authenticated;
