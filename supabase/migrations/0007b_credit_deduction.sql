-- 0007b_credit_deduction.sql
-- Safe additive migration to add deduct_tenant_credits RPC.
-- Apply AFTER 0007_credits.sql.

create or replace function public.deduct_tenant_credits(p_tenant_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v_new_balance numeric;
begin
  update public.tenants
    set credit_balance = credit_balance - p_amount
  where id = p_tenant_id and credit_balance >= p_amount
  returning credit_balance into v_new_balance;
  return v_new_balance;
end;
$$;

grant execute on function public.deduct_tenant_credits(uuid, numeric) to authenticated;
