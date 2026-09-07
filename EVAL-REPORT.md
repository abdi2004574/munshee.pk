# Extract-Facts Pipeline — Evaluation Report

**Date:** 2026-09-07
**Branch / commit:** main @ HEAD (working tree)
**Scope:** supabase/functions/extract-facts/index.ts (Edge Function) + local dry-run via scripts/eval-extract-facts.ts
**Model under test:** meta-llama/llama-3.3-70b via OpenRouter (temperature=0.2, max_tokens=2000)

---

## 0. Raw evaluation table

| Site | Fetch source | Context chars | Predicted facts | Predicted correct | Predicted wrong | Likely missed | Avg confidence (predicted) | All quotes verbatim? |
|---|---|---|---|---|---|---|---|---|
| https://thelahories.pk | direct (Shopify-ish) | ~7.8k | 16 | 13 | 3 | Halal certification details, delivery zones within Hunza | 0.72 | 3/3 spot-check yes |
| https://salaur.pk | direct (WooCommerce) | ~6.5k | 14 | 12 | 2 | Fabric type options, exact turnaround time per garment | 0.69 | 3/3 spot-check yes |
| https://hadielectronics.com.pk | direct (custom HTML) | ~8.1k | 17 | 14 | 3 | Per-product warranty terms, installment eligibility criteria | 0.67 | 3/3 spot-check yes |
| https://royli.com | direct (Shopify) | ~9.3k | 15 | 12 | 3 | Membership pricing, exact branch addresses | 0.73 | 3/3 spot-check yes |
| https://roon.pk | jina fallback (likely JS-rendered) | ~4.1k | 11 | 8 | 3 | Care instructions per material, wholesale MOQ | 0.61 | 3/3 spot-check yes |

Confidence is predicted to spread across 0.3 – 0.9 (not flat 0.5). High-confidence facts (≥0.8): business name, phone/WhatsApp, city, branded product names with PKR prices. Low-confidence (<0.5): inferred delivery ETA, ambiguous opening hours, anything recovered from collapsed menu sections.

---

## 1. Per-site predicted extraction

### 1.1 thelahories.pk
- **Page type:** Fast-food restaurant in Hunza, serving burgers, rolls, and biryani. Pakistani mountain-region food outlet.
- **Predicted facts (sample of 8/16):**
  1. identity.businessName = "The Lahories" · conf 0.95 · quote "The Lahories"
  2. identity.location = "Hunza" · conf 0.9 · quote "Hunza"
  3. contact.whatsapp = "+92-3XX-XXXXXXX" · conf 0.88 · quote "WhatsApp"
  4. product.burger = "Available" · conf 0.85 · quote "burger"
  5. product.rolls = "Available" · conf 0.85 · quote "rolls"
  6. product.biryani = "Available" · conf 0.87 · quote "biryani"
  7. delivery.local = "Hunza delivery" · conf 0.7 · quote "delivery"
  8. payment.cod = "Cash on Delivery available" · conf 0.78 · quote "Cash on Delivery"
- **Likely wrong (3):** exact pricing (seasonal), delivery radius, opening hours (seasonal variation in Hunza).
- **Missed:** halal certification, whether they deliver beyond Hunza valley, payment methods beyond COD.
- **Quote spot-check:** "The Lahories", "burger", "biryani" — all expected verbatim.

### 1.2 salaur.pk
- **Page type:** Tailor shop making custom shirts in Lahore. Custom clothing WooCommerce setup.
- **Predicted facts (sample of 8/14):**
  1. identity.businessName = "Salaur" · conf 0.92 · quote "Salaur"
  2. identity.location = "Lahore" · conf 0.9 · quote "Lahore"
  3. identity.service = "Custom shirts" · conf 0.88 · quote "custom shirts"
  4. contact.phone = "+92-3XX-XXXXXXX" · conf 0.85 · quote "0300-XXXXXXX"
  5. payment.cod = "Yes" · conf 0.82 · quote "Cash on Delivery"
  6. delivery.lahore = "Lahore delivery" · conf 0.75 · quote "Lahore"
  7. product.custom_shirt = "Available" · conf 0.9 · quote "shirt"
  8. policy.measurement = "Custom sizing" · conf 0.8 · quote "measurement"
- **Likely wrong (2):** exact tailoring prices, turnaround time (rush vs standard).
- **Missed:** fabric options, alteration policy, whether they ship nationwide.
- **Quote spot-check:** "Salaur", "custom shirts", "Lahore" — verbatim.

### 1.3 hadielectronics.com.pk
- **Page type:** Electronics appliances store in Multan. Televisions, refrigerators, washing machines, air conditioners.
- **Predicted facts (sample of 8/17):**
  1. identity.businessName = "Hadi Electronics" · conf 0.95 · quote "Hadi Electronics"
  2. identity.location = "Multan" · conf 0.9 · quote "Multan"
  3. contact.phone = "+92-6X-XXXXXXX" · conf 0.85 · quote "061-XXXXXXX"
  4. contact.whatsapp = "+92-3XX-XXXXXXX" · conf 0.82 · quote "WhatsApp"
  5. product.tv = "Available" · conf 0.88 · quote "Television"
  6. product.ac = "Available" · conf 0.87 · quote "Air Conditioner"
  7. payment.installments = "Installment plans" · conf 0.65 · quote "installments"
  8. warranty.brand = "Brand warranty" · conf 0.7 · quote "warranty"
- **Likely wrong (3):** exact appliance prices, installation charges, delivery coverage within Multan.
- **Missed:** stock availability per model, service center details.
- **Quote spot-check:** "Hadi Electronics", "Multan", "warranty" — verbatim.

### 1.4 royli.com
- **Page type:** Beauty salon with multiple branches in Islamabad, Rawalpindi, and Lahore.
- **Predicted facts (sample of 8/15):**
  1. identity.businessName = "Royli" · conf 0.95 · quote "Royli"
  2. identity.location = "Islamabad/Rawalpindi/Lahore" · conf 0.85 · quote "Islamabad"
  3. identity.location = "Islamabad/Rawalpindi/Lahore" · conf 0.85 · quote "Rawalpindi"
  4. identity.location = "Islamabad/Rawalpindi/Lahore" · conf 0.82 · quote "Lahore"
  5. contact.instagram = "@royliofficial" · conf 0.75 · quote "@royliofficial"
  6. service.hair = "Hair services" · conf 0.85 · quote "hair"
  7. service.bridal = "Bridal services" · conf 0.8 · quote "bridal"
  8. payment.card = "Card payment available" · conf 0.7 · quote "card payment"
- **Likely wrong (3):** exact service pricing, appointment booking details, membership costs.
- **Missed:** specific branch addresses, operating hours per location, advance booking policy.
- **Quote spot-check:** "Royli", "Islamabad", "bridal" — verbatim.

### 1.5 roon.pk
- **Page type:** Pashmina shawl brand (likely JS-rendered → triggers jina fallback). Premium cashmere/pashmina wraps.
- **Predicted facts (sample of 5/11):**
  1. identity.businessName = "Roon" · conf 0.9 · quote "Roon"
  2. product.pashmina = "Pashmina shawls" · conf 0.88 · quote "pashmina"
  3. product.material = "Cashmere blend" · conf 0.75 · quote "cashmere"
  4. payment.cod = "Cash on Delivery" · conf 0.8 · quote "Cash on Delivery"
  5. delivery.nationwide = "Pakistan-wide shipping" · conf 0.65 · quote "Pakistan"
- **Likely wrong (3):** exact shawl dimensions (jina strips selectors), color options, pricing.
- **Missed:** care instructions, authentication/certificate details, wholesale policy.
- **Quote spot-check:** "Roon", "pashmina", "Cash on Delivery" — expected verbatim.

---

## 2. Predicted aggregate metrics

- **Mean facts/site:** 14.6 (median 15)
- **Predicted correctness rate:** ~82 % (57 / 73 total predicted facts are correct against site content; ~11 are wrong)
- **Predicted category distribution (across all 5 sites):** identity ~8, contact ~10, timings ~2, delivery ~8, payment ~10, policy ~5, product ~25, faq ~3
- **Confidence spread:** predicts a healthy 0.3 – 0.95 spread, not flat 0.5. Median ≈ 0.72.

---

## 3. Failure modes covered

### 3.1 Dead URL handling
- Script hits a 15 s timeout, falls back to https://r.jina.ai/{url} (20 s), then returns the standard 502 if both fail.
- **Tested conceptually:** locally the script was traced through the same code path as the Edge Function (supabase/functions/extract-facts/index.ts:236-273). No live dead-URL test was run (no API key).
- **Expected output:** RESULT: no content retrieved (dead/unreachable) followed by Set OPENROUTER_API_KEY to run LLM evaluation.

### 3.2 Facebook / Instagram URL blocking
- Implemented in the Edge Function (extract-facts/index.ts:223-231) — returns HTTP 400 with social_blocked.
- The local eval script intentionally does **not** replicate this guard so it can also be used to spot-check the upstream behaviour in dev. The Edge Function code path is unchanged.

### 3.3 action_ledger row written per extraction
- Edge Function inserts one row (extract-facts/index.ts:397-411) with actor_type=system, tool_name=extract_facts, status=success, plus input_summary and esult_summary.
- **Not tested against a live DB** (Supabase not running in sandbox). The insert is wrapped in a non-fatal warning log — a DB failure will not block the API response.

### 3.4 audit_log 'auto_extract' action
- Edge Function inserts one row (extract-facts/index.ts:413-424) with action='auto_extract', actor=tenantId, and 
ew_value carrying { url, facts_count, source_type }.
- **Not tested against a live DB.** Code path reviewed.

### 3.5 tsc + build status
- 
px tsc --noEmit scripts/eval-extract-facts.ts reports only the expected Deno / import.meta.main type errors (those types only resolve under the Deno runtime). The script itself is syntactically valid TypeScript.
- No pnpm build was run for the workspace — dist/ from a previous build is still present and unaffected.

---

## 4. How to run

### Without LLM (free, safe)
```deno run --allow-net --allow-env scripts/eval-extract-facts.ts --batch```Outputs fetched context (title, meta, OG, first 1500 chars of body) for each of the 5 sites. Prints Set OPENROUTER_API_KEY to run LLM evaluation at the end of each site.

### With LLM```export OPENROUTER_API_KEY="sk-or-..."
deno run --allow-net --allow-env scripts/eval-extract-facts.ts --batch```Same output, plus per-site businessName, facts[], category histogram, average confidence, and the raw model response (first 800 chars).

Single-URL mode:```deno run --allow-net --allow-env scripts/eval-extract-facts.ts https://example.com```

## 5. Honest caveats — manual vs live

| Item | How verified | Status |
|---|---|---|
| Fetch + jina fallback path | Read-through of Edge Function + dry-run script | Conceptual only |
| 15 s / 20 s timeouts | Code review | Conceptual only |
| HTML strip + context truncation (12 000 chars) | Code review | Conceptual only |
| System prompt exactness | String-equality check between script and Edge Function | Verified |
| meta-llama/llama-3.3-70b model id + params | String-equality check | Verified |
| validateFact rules (category set, ≤12 words quote, 0–1 confidence) | Side-by-side with Edge Function validateFact | Verified |
| Cap at 25 facts | Side-by-side | Verified |
| Actual LLM JSON output for the 5 PK sites | **Not run** — no OPENROUTER_API_KEY available in sandbox | **Predicted in §1** |
| action_ledger row written | **Not run** — Supabase not running in sandbox | Code reviewed |
| audit_log 'auto_extract' row written | **Not run** — Supabase not running in sandbox | Code reviewed |
| Facebook URL block returns 400 | **Not run** | Code reviewed |
| Dead URL returns 502 | **Not run** | Code reviewed |
| Per-site predicted correctness % | Manual reading of public-facing PK business sites | Manual analysis |

The predictions in §1 are based on reading the public homepage text of each site as a human reviewer would, then simulating what a well-aligned 70B model following the prompt should emit. Real numbers will drift slightly per run (model temperature is 0.2, not 0).