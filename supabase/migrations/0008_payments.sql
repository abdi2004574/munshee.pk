-- 0008_payments.sql
-- Phase 3: Payment integration scaffold
-- Adds payment_transactions table and complete_payment_transaction RPC.

-- ============================================================================
-- 1. payment_transactions
-- ============================================================================

create table if not exists public.payment_transactions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  plan_id          text not null references public.subscription_plans(id),
  provider         text not null check (provider in ('jazzcash', 'easypaisa')),
  amount_pkr       numeric not null,
  status           text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  gateway_ref      text,
  gateway_response jsonb,
  credits_added    numeric not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists payment_transactions_tenant_idx
  on public.payment_transactions (tenant_id);

alter table public.payment_transactions enable row level security;

drop policy if exists payment_transactions_tenant_select on public.payment_transactions;
create policy payment_transactions_tenant_select on public.payment_transactions
  for select using (tenant_id = auth.uid());

drop policy if exists payment_transactions_tenant_insert on public.payment_transactions;
create policy payment_transactions_tenant_insert on public.payment_transactions
  for insert with check (tenant_id = auth.uid());

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row execute function public.handle_updated_at();

grant usage on schema public to authenticated;
grant select, insert on public.payment_transactions to authenticated;

-- ============================================================================
-- 2. complete_payment_transaction RPC
-- ============================================================================

create or replace function public.complete_payment_transaction(
  p_transaction_id  uuid,
  p_gateway_ref     text,
  p_gateway_response jsonb
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
begin
  if v_tenant is null then
    raise exception 'authentication required';
  end if;

  select pt.plan_id, pt.amount_pkr, sp.monthly_credits, pt.credits_added
    into v_plan_id, v_amount, v_plan_credits, v_credits_added
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
        gateway_response = p_gateway_response
    where id = p_transaction_id;

  update public.tenants
    set credit_balance = credit_balance + v_credits_added
    where id = v_tenant
    returning credit_balance into v_new_balance;

  insert into public.credit_ledger (tenant_id, action_type, credits_used, balance_after, reference_id)
    values (v_tenant, 'plan_topup', -v_credits_added, v_new_balance, p_transaction_id::text);

  return v_new_balance;
end;
$$;

grant execute on function public.complete_payment_transaction(uuid, text, jsonb) to authenticated;