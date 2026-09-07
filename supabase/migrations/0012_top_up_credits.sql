-- 0012_top_up_credits.sql
-- Phase: Credit top-up flow for paid and trial tiers.
-- Adds purchase_top_up RPC and enhances payment_transactions for top-ups.

-- ============================================================================
-- 1. Add topup_type column to payment_transactions if missing
-- ============================================================================

alter table public.payment_transactions
  add column if not exists topup_type text check (topup_type in ('credit_pack', 'subscription'));

-- ============================================================================
-- 2. purchase_top_up RPC
-- ============================================================================
-- Creates a pending payment transaction for a credit top-up.
-- The caller specifies the number of credits; the RPC calculates the PKR amount
-- based on the tenant's current subscription plan top-up rate.
-- After payment completion, complete_payment_transaction will credit the tenant.

create or replace function public.purchase_top_up(
  p_credits numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant      uuid := auth.uid();
  v_plan_id     text;
  v_rate_pkr    numeric;
  v_amount_pkr  numeric;
  v_txn_id      uuid;
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'credits must be a positive number';
  end if;

  -- Determine the tenant's current plan and top-up rate.
  -- If the tenant has a completed subscription, use that plan's rate.
  -- Otherwise fall back to the free plan rate (0, meaning they must choose a paid plan first).
  select sp.id, sp.top_up_rate_pkr
    into v_plan_id, v_rate_pkr
    from public.subscription_plans sp
    join public.payment_transactions pt on pt.plan_id = sp.id
   where pt.tenant_id = v_tenant
     and pt.status = 'completed'
     and sp.price_pkr > 0
   order by pt.created_at desc
   limit 1;

  if v_plan_id is null then
    -- No active paid plan; use starter rate as default for top-up
    select id, top_up_rate_pkr into v_plan_id, v_rate_pkr
      from public.subscription_plans
     where id = 'starter'
     limit 1;
  end if;

  if v_rate_pkr is null or v_rate_pkr <= 0 then
    raise exception 'no valid top-up rate found for tenant plan';
  end if;

  v_amount_pkr := p_credits * v_rate_pkr;

  insert into public.payment_transactions
    (tenant_id, plan_id, provider, amount_pkr, status, credits_added, topup_type)
  values
    (v_tenant, v_plan_id, 'jazzcash', v_amount_pkr, 'pending', p_credits, 'credit_pack')
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

grant execute on function public.purchase_top_up(numeric) to authenticated;

-- ============================================================================
-- 3. Update complete_payment_transaction to handle top-ups
-- ============================================================================

create or replace function public.complete_payment_transaction(
  p_transaction_id  uuid,
  p_gateway_ref     text,
  p_gateway_response jsonb,
  p_provider        text default 'jazzcash'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant       uuid := auth.uid();
  v_plan_id      text;
  v_amount       numeric;
  v_plan_credits numeric;
  v_credits_added numeric;
  v_new_balance  numeric;
  v_topup_type   text;
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  select pt.plan_id, pt.amount_pkr, sp.monthly_credits, pt.credits_added, pt.topup_type
    into v_plan_id, v_amount, v_plan_credits, v_credits_added, v_topup_type
    from public.payment_transactions pt
    join public.subscription_plans sp on sp.id = pt.plan_id
   where pt.id = p_transaction_id
     and pt.tenant_id = v_tenant
     and pt.status = 'pending'
   for update;

  if not found then
    raise exception 'transaction not found or not pending';
  end if;

  update public.payment_transactions
     set status = 'completed',
         gateway_ref = p_gateway_ref,
         gateway_response = p_gateway_response,
         provider = p_provider,
         updated_at = now()
   where id = p_transaction_id;

  if v_topup_type = 'credit_pack' then
    -- Top-up: add the purchased credits directly
    update public.tenants
       set credit_balance = credit_balance + v_credits_added
     where id = v_tenant
     returning credit_balance into v_new_balance;

    insert into public.credit_ledger (tenant_id, action_type, credits_used, balance_after, reference_id)
      values (v_tenant, 'plan_topup', -v_credits_added, v_new_balance, p_transaction_id::text);
  else
    -- Subscription: add monthly credits
    update public.tenants
       set credit_balance = credit_balance + v_plan_credits
     where id = v_tenant
     returning credit_balance into v_new_balance;

    insert into public.credit_ledger (tenant_id, action_type, credits_used, balance_after, reference_id)
      values (v_tenant, 'plan_subscription', -v_plan_credits, v_new_balance, p_transaction_id::text);
  end if;

  return v_new_balance;
end;
$$;

grant execute on function public.complete_payment_transaction(uuid, text, jsonb, text) to authenticated;
