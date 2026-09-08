-- 0018_eval_weekly.sql
-- Weekly evaluation harness: last 14 days of extraction accuracy by source_type.
-- Read-only view for admin reporting.

-- ============================================================================
-- 1. eval_weekly view
-- ============================================================================

create or replace view public.eval_weekly as
with fact_summary as (
  select
    tenant_id,
    source_type,
    count(*) as total,
    count(*) filter (where status = 'confirmed') as confirmed_count,
    count(*) filter (
      where status = 'confirmed'
        and not exists (
          select 1
          from public.audit_log al
          where al.tenant_id = business_facts.tenant_id
            and al.fact_id = business_facts.id
            and al.action = 'edit'
        )
    ) as confirmed_without_edit,
    avg(confidence) as avg_confidence
  from public.business_facts
  where created_at >= now() - interval '14 days'
    and deleted_at is null
  group by tenant_id, source_type
),
business_actions as (
  select
    business_id,
    sum(abs(delta)) as actions_used
  from public.credit_ledger
  where created_at >= now() - interval '14 days'
  group by business_id
)
select
  fs.tenant_id,
  fs.source_type,
  fs.total,
  case
    when fs.confirmed_count > 0 then
      round((fs.confirmed_without_edit::numeric / fs.confirmed_count) * 100, 1)
    else 0
  end as pct_confirmed_without_edit,
  round(coalesce(fs.avg_confidence, 0), 3) as avg_confidence,
  coalesce(ba.actions_used, 0) as actions_used
from fact_summary fs
left join business_actions ba on ba.business_id = fs.tenant_id
order by fs.tenant_id, fs.source_type;

-- ============================================================================
-- 2. Grants
-- ============================================================================

grant select on public.eval_weekly to authenticated;
