-- 0021_update_business_facts_categories.sql
-- Updates business_facts.category check constraint to accept the category values
-- emitted by the extraction functions (extract-facts, extract-text, extract-vision,
-- re-scan-business): identity, contact, timings, delivery, payment, policy, product, faq.
-- Preserves existing categories for backward compatibility with legacy data.

alter table public.business_facts
  drop constraint if exists business_facts_category_check;

alter table public.business_facts
  add constraint business_facts_category_check
  check (category in (
    'identity',
    'contact',
    'timings',
    'delivery',
    'payment',
    'policy',
    'product',
    'faq',
    'pricing',
    'hours',
    'location',
    'service_area',
    'brand_voice'
  ));
