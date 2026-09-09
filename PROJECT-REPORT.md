# ═══════════════════════════════════════════════════════════
# MUNSHEE.PK — MASTER PROJECT REPORT (v4 — CORRECTED)
# Source of truth for ALL AI sessions (Kilo / Claude / z.ai)
# Last updated: 2026-09-09 | Verified by: founder (SQL evidence)
#               + codebase audit by Kilo (v4 corrections below)
# ═══════════════════════════════════════════════════════════

## ⚠️ v4 CHANGE-LOG (what v3 got wrong — corrections from code audit)

| v3 Claim | Reality (verified by code audit) | Status |
|---|---|---|
| Finding 3.1: "state.md empty" | state.md has 44 lines of real content | **CORRECTED** |
| Migration 0022 "fixed" credit_ledger, consume_action, vocabulary | 0022_schema_reconciliation.sql is EMPTY (`\`) | **CORRECTED** |
| "0023b NOT STARTED" | 0023b migration file EXISTS on disk, fully written | **CORRECTED** |
| 4.2: consume_action subscription_status "Fix pending in 0023b" | 0023 already adds `subscription_status` to return type | **CORRECTED** |
| 1.2: extract-vision has "non-existent `action` column" | Current code already uses `log_vision_extraction` RPC | **ALREADY FIXED** |
| 1.3: askMunsheeTool is a "hardcoded stub" | Full implementation calling real edge function | **CORRECTED** |
| 1.4: hardcoded strings only in ExtractText/ExtractFacts | 6+ files have hardcoded strings (BillingPage, ClientsPage, AdminPage, ImportNewPage, ReviewQueuePage, agent-tools.ts) | **EXPANDED** |
| 5.3: Free plan says "50 actions" | All 4 locale files already show "150 actions/month" | **FALSE — CORRECTED** |
| 5.1: spec deletes live tables with TEST guard | Guard checks `startsWith('TEST-')` on UUID user IDs — ALWAYS FAILS | **CORRECTED** |
| §7: "Playwright billing-flow.spec.ts" | File is `billing-gating.spec.ts`, already exists & passing structure | **RENAMED** |
| "3 divergent vocabularies" | Actually 4 vocabularies + autonomy_settings constraint mismatch | **EXPANDED** |
| Missing nav keys in roman_ur.json | 11 nav keys missing (scrape, review, extract_text, etc.) | **NEWLY DOCUMENTED** |

---

## §1 — PROJECT IDENTITY
- Product: Munshee.pk — Pakistan-first AI business OS for local merchants (autonomous AI business manager)
- Dual-mode platform: merchants self-serve + experts manage client merchants on the SAME product
- Founder: Abdur (solo, student, non-coder — AI-assisted building)
- Languages: EN / Urdu script / Roman Urdu / en-PK. Currency: PKR
- v1 segment: tech-savvy online sellers self-serve; experts serve semi-literate merchants
- Deployment: FROZEN until Phase 1 close + 5 test merchants (founder decision 2026-09-09). Local dev + preview only until then.
- LUMEN (local-first agent swarm concept): ARCHIVED in docs/VISION.md as Phase 7+ direction. NOT active build. Do not reference as scope.
- Stack: React 19 + TypeScript (strict) + Vite + Tailwind 3.4 + React Query v5 + React Router 7 + Supabase (Auth PKCE, Postgres, Storage, Edge Functions/Deno)
- AI: single Munshee-owned OpenRouter account + internal ledger. Per-merchant API keys REJECTED. Self-hosting REJECTED (no GPU).
  Models: llama-3.3-70b-instruct (text), qwen-2.5-vl-72b (vision), Whisper via Groq (voice, Phase 2). GEMINI BANNED everywhere.

## §2 — LOCKED DECISIONS (do not re-litigate)
- PRICING LOCKED (verified live in DB 2026-09-09):
  Free 0 PKR / 150 Actions · Starter 4500 / 800 · Business 8500 / 2000 · OS 19000 / 5000
  Action Packs (all tiers): 100=800, 250=1800, 500=3000 (90-day validity). Annual = 10 months ka daam.
  Setup fee 2500 (founding 10 waived). Manual payment + admin activation (no gateway yet).
- Merchant-facing word = "Actions" (credits internal only)
- ROI Ledger = day-one principle. value_log + "Wasool hua ✓" = conversion engine. Never fake value numbers.
- WhatsApp: export-forward now; Cloud API (BSP coexistence) Phase 4. Meta OAuth: Phase 3 (app review should be submitted early).
- NOT-EVER (no phase): auto tax PAYMENT · Meta ads media-buying autonomy (drafts only) · full accounting/POS suite · auto-reply without approval below L4 · fully autonomous order/payment placement · scraping private WA groups
- Bootstrap: no investment until paying merchants exist
- Repo PRIVATE. Agent references: agent.md + this file are the map.
- Autonomy DIAL unlocks by blast radius + eval track record, NOT by calendar. Launch dial = Level 1–2. Level 4 gated on 90-day ≥85% draft-acceptance. Level 5 (payments/orders) = ALWAYS approval.

## §3 — VERIFIED BUILD STATUS (evidence-backed, 2026-09-09)

### 3.1 — CONFIRMED WORKING (founder-verified via live SQL)
- Migrations 0001–0023 applied to remote DB (supabase db push: "Remote database is up to date")
- Migration 0022_schema_reconciliation.sql is EMPTY (contains only `\`) — see §3.3
- Migration 0023b_vocabulary_unification_and_ledger_fixes.sql EXISTS ON DISK and is fully written — pending founder db push
- Locked pricing LIVE: plans table = free 0/150, starter 4500/800, business 8500/2000, os 19000/5000 (screenshot evidence saved)
- Persistence PROVEN: 117 rows in business_facts (all needs_review, all dated 2026-09-09, multi-day extraction runs)
- Auth/provisioning: 25 profiles exist, 11 subscriptions auto-created on signup (all free/trial)
- rescan_schedules table exists (0 rows = unused, normal)
- Orch-stranger orphaned business "My Business" (e794b5aa...) with no subscription (low priority cleanup)

### 3.2 — EXTRACTION EVAL (5 real PK sites)
- Precision: 52/52 = 100% (zero wrong, 15/15 quotes verbatim)
- Recall: ~50% — ROOT CAUSE CONFIRMED by audit: NO multi-page crawl exists (single-page only). 117 facts = multiple single-page runs, NOT improved coverage
- Confidence calibration broken: 3/5 sites return flat 1.0
- Error strings contain � null bytes (broken em-dash encoding) in edge function error messages
- Task 0.2b (recall fix) = NOT YET PUSHED to remote (code changes on disk, not deployed)

### 3.3 — KNOWN SCHEMA REALITY (drift from original design — DB IS TRUTH)

**CRITICAL — migrations that exist on disk but are NOT yet applied to remote DB:**
- 0023_fix_credit_ledger_schema_and_rpc_contracts.sql — fixes credit_ledger column names + consume_action return type
- 0023b_vocabulary_unification_and_ledger_fixes.sql — fixes vocabulary divergence + creates log_vision_extraction RPC

**Migration 0022 is a NO-OP placeholder:**
- 0022_schema_reconciliation.sql contains only `\` (1 byte). It does NOTHING.
- state.md incorrectly attributes fixes to 0022. The actual fixes live in:
  - 0020_locked_pricing.sql → reference_number, plans table, action_packs table
  - 0017_billing_core.sql → consume_action, subscription_status (OLD version, no subscription_status)
  - 0023_fix_credit_ledger → consume_action with subscription_status, credit_ledger reconciliation
  - 0023b → feature vocabulary unification, log_vision_extraction RPC

**Feature vocabulary divergence — 4 vocabularies exist (not 3 as v3 claimed):**

| System | Vocabulary used | Example keys |
|---|---|---|
| 0017/0023 consume_action (DB function) | Singular | `udhaar_draft`, `invoice`, `voice_digest`, `ad_draft`, `client`, `rescan` |
| 0020 plans.features (DB seed) | Mixed/inconsistent | `udhaar_drafts`, `invoices`, `rescans_monthly` (not `rescans`), `voice_items`, `ads_drafts`, `udhaar_full` (not `udhaar_drafts`), `invoices_unlimited` (not `invoices`) |
| 0023b consume_action (DB function, on disk) | Plural (matching 0020) | `udhaar_drafts`, `invoices`, `voice_items`, `ads_drafts`, `clients`, `rescans` |
| featureFlags.ts (frontend) | Completely different | `watermark`, `client_switcher`, `ask_munshee`, `voice_digest`, `wa_export_analysis`, `reporting_export`, `directory_eligible` |

**autonomy_settings action_type constraint (0016) is BROKEN:**
- 0016 creates constraint: `action_type in ('rescan', 'digest', 'reply_draft', 'udhaar_reminder', 'invoice')`
- These are SINGULAR forms that don't match ANY vocabulary in consume_action or plans.features
- Attempting to set autonomy for `udhaar_drafts`, `invoices`, `voice_items`, etc. will FAIL with CHECK constraint violation

**re-scan-business edge function has vocabulary mismatch with 0023b:**
- re-scan-business/index.ts line 291 calls `consumeAction(supabase, tenantId, "rescan")` (singular)
- 0023b's consume_action checks for `rescans` (plural) — so the rescans feature cap will NOT be enforced after 0023b is pushed
- Fix: update re-scan-business to call with `"rescans"`

**profile.full_name mostly NULL (20/25)** — UI has non-null assertion crash risk
**25 profiles exist** (many AI-test signups) — cleanup low priority

## §4 — AUDIT FINDINGS REGISTER (Kilo adversarial audit 2026-09-09)
Status: FIXED / PENDING-0023b / PENDING-VERIFICATION / BACKLOG

### CRITICAL
- 3.3 state.md NOT empty → CORRECTED in this report
- 4.1 credit_ledger schema mismatch → FIXED in 0023, founder verification V1 PENDING
- 4.2 consume_action missing subscription_status → FIXED in 0023 (NOT 0023b as v3 claimed), founder verification PENDING
- 4.3 feature vocabulary divergence → PENDING 0023b (file on disk, needs push) + frontend vocab fix + constraint fix + re-scan edge function update
- 0022 is a no-op → DOCUMENTED (not a code bug, but state.md references are wrong)

### HIGH
- 1.1 no multi-page crawl → PENDING Task 0.2b (priority #1 after 0023 push)
- 1.2 extract-vision ledger bug → FIXED in code (already uses log_vision_extraction), needs 0023b DB push
- 5.1 agent-primitives.spec.ts broken TEST guard → PENDING FIX (UUID check always fails)
- 2.1 possibly_removed never resolves → BACKLOG (needs merchant-review flow, Phase 1)
- 1.4 hardcoded strings in extraction pages → PARTIALLY FIXED (ExtractFactsPage OK; ExtractTextPage has 2)

### MEDIUM
- 1.3 askMunsheeTool hardcoded fallback string → PENDING (1 hardcoded Urdu string in agent-tools.ts:210)
- 1.4 hardcoded strings across 6+ files → PENDING (see §5.4 for full list)
- 4.6 featureFlags.ts vocab mismatch vs consume_action → PENDING 0023b + frontend unification
- 5.3 i18n Free plan "50 actions" → FALSE (already 150 in all 4 locale files)
- 3.3 migration 0011 destructive DELETE → BACKLOG (delete on subscription_plans, not real data, but violates principle)
- 5.2 fact-count evidence not machine-asserted → BACKLOG

### LOW
- 2.2 extract_facts checks "rescan" autonomy level → BACKLOG (semantically questionable, by design)
- 2.3 rescan_schedules.next_run_at never maintained → BACKLOG
- 3.4 .kilo/worktrees/comet-stranger/ relic → PENDING deletion
- 4.5 full_name nullable + UI non-null assertion → BACKLOG
- 4.7 orphan subscription_plans table → BACKLOG cleanup
- Missing nav keys in roman_ur.json (11 keys) → PENDING fix

### NEWLY DISCOVERED (not in v3)
- 3.1a state.md incorrectly attributes fixes to migration 0022 (which is empty)
- 3.2a Migration 0023b is NOT "not started" — file exists and is complete
- 1.5 re-scan-business uses singular "rescan" but 0023b expects "rescans"
- 1.6 autonomy_settings constraint in 0016 only allows 5 old action_type values, blocking new ones
- 5.1a TEST guard in agent-primitives.spec.ts is structurally broken (UUID startsWith check)
- 5.4 Hardcoded strings in: BillingPage.tsx:89, ClientsPage.tsx:72, AdminPage.tsx:60,64, ImportNewPage.tsx:149,174, ReviewQueuePage.tsx:110,122, agent-tools.ts:210
- 5.5 Broken replacement char (�) in 4 locale files (line 212) + BillingPage.tsx:19,284 + edge functions
- 3.3a Missing MASTER-BLUEPRINT.md confirmed (Finding 3.2 in v3 was correct)

## §5 — MANDATORY RULES (violations = task not done)

EVIDENCE RULE: Every completion report MUST include raw outputs:
git log --oneline -5, git status, SQL query results for DB claims, Playwright run output, exact file paths. "Designed to pass" ≠ passed. (2+ fake-done reports happened historically.)

ACCEPTANCE INTEGRITY: If any DONE-WHEN criterion fails, task status = "PARTIAL — blocked on: X" with exact error pasted. Never mark complete with failed acceptance.

TEST DATA RULE: Never TRUNCATE/DELETE real data in tests. Tests run only against TEST- prefixed tenant. Guard assertion before any delete. Local supabase start stack preferred. AGENTS.md specifies TEST_TENANT_ID guard but no such constant exists in code — tests must define it.

CONTEXT BOUNDARY: No knowledge of external tools/products unless in repo or fully described in prompt. Never act on "X-style" references.

TASK PROTOCOL: Restate ≤3 lines → list files → COMPLETE code only → self-check (typecheck, build, check:i18n, Playwright) → summary + manual test steps + evidence.

SELF-REVIEW LOOP: Before reporting done, review own code as senior reviewer: security holes (RLS bypass, client secrets), performance (N+1, missing indexes), missing edge cases.

## §6 — ROADMAP (phase gates, frozen order)
P0 FOUNDATION — 85%: ✅ primitives, ✅ real extraction (precision proven), ✅ billing locked (E1 verified), 🟡 reconciliation (0023/0023b on disk → push needed → verify), 🟡 evidence gaps (restore test 17/21, 0011 destructive note), 🔴 deploy FROZEN, ✅ eval harness
P1 AUTONOMY L1–2: 1.1 re-scan skeleton EXISTS but runs on single-page extraction — needs 0.2b first
P2 EXPERTS+VOICE: voice→facts (Groq), photo-catalog (Qwen), expert mode polish
P3 DRAFTS+META: reply drafts L3, rules engine v0, Meta OAuth
P4 LEVEL 4 + WA API: WhatsApp Cloud API (BSP coexistence), auto-send for qualified
P5 SCALE: Tax-Ready module, marketplace flywheel, Roman Urdu fine-tune

## §7 — PENDING QUEUE (frozen execution order)
1. **FOUNDER**: Run `supabase db push` to apply 0023 + 0023b to remote DB. Then run V1–V4 SQL verification:
   - V1: `get_credit_ledger` returns reconciled columns (business_id, delta, reason, expires_at)
   - V2: `consume_action` returns 5 columns including `subscription_status`
   - V3: `subscriptions.reference_number` column exists
   - V4: `get_feature_flags` returns unified vocabulary; consume_action uses plural keys
2. **KILO**: 0023b follow-up — fix re-scan-business to use "rescans" (singular→plural), fix autonomy_settings constraint in 0016, fix broken TEST guard in spec/agent-primitives.spec.ts, fix hardcoded strings in 6+ files, add missing nav keys to roman_ur.json, fix broken replacement chars (�) in locale files + BillingPage.tsx + edge functions, delete comet-stranger worktree
3. **FOUNDER**: re-verify V1–V4 after 0023b push
4. **KILO**: Task 0.2b — multi-page crawl (6 internal links), always-parallel Jina fetch, facts cap 40 / max_tokens 3000, confidence calibration + clamping, null-byte fix
5. **FOUNDER+KILO**: eval round 2 (same 5 sites) — target recall ≥65%, precision ≥95%
6. Phase 0 CLOSE → Phase 1 unlock

## §8 — FOUNDER VERIFICATION PROTOCOL
- Kilo claims → founder runs SQL/browser check → only then TRUE
- Two AI audits converging on same finding = high confidence
- DB is truth over reports; git history over memory
- All evidence saved to docs/evidence/ (numbered, dated)
- Predictions get logged with confidence % and graded after

## §9 — CURRENT SPRINT STATE & NEXT ACTIONS (2026-09-09 evening)

**Pending queue: see §7 above.** Next immediate actions, in frozen order:

1. **FOUNDER**: Run `supabase db push` to apply 0023 + 0023b to remote DB
2. **FOUNDER**: Run V1–V4 SQL verification (see §7 step 1)
3. **KILO**: Execute 0023b follow-up fixes (see §7 step 2): broken TEST guard, hardcoded strings, � chars, missing nav keys, re-scan vocab, delete comet-stranger
4. **KILO**: Task 0.2b — multi-page crawl + confidence calibration
5. **FOUNDER+KILO**: Eval round 2 (same 5 sites) — target recall ≥65%, precision ≥95%

---

## 🏁 NON-TECHNICAL SUMMARY (for founder / merchants / stakeholders)

> **Munshee.pk ek aisi AI Business Manager hai jo aapki dukan ki saari jaankari
> automatically nikaal sakti hai — website se, text se, photo se, aur even
> WhatsApp se. Yeh aapko facts verify karne ke liye deti hai, kabhi bina
> soche directly kisi bhi cheez par kaam nahi karti.**

### 💰 Aapke plan kehte hain (Monthly, PKR)

| Plan | Price | Actions | Kya mile |
|------|-------|---------|----------|
| **Free** | Rs 0 | 150 | Text extraction, 1 business, watermark |
| **Starter** | Rs 4,500 | 800 | Text + vision, Ask Munshee, WhatsApp export, voice digest |
| **Business** | Rs 8,500 | 2,000 | All of above + up to 6 businesses, client switching |
| **OS** | Rs 19,000 | 5,000 | Everything + Tax Ready, full ROI ledger, directory |

> **Actions** = aapko har maheene milne waala AI credit hai. Jab khatam ho jaye toh
> pack (100/250/500) buy kar sakte hain. Annual plan = 10 months ka hisab.

### 🧠 Munshee ka Decision-Making Flow

```
[Website / Text / Photo / WhatsApp]
        ↓
  AI extracts business facts
  (name, phone, hours, products, etc.)
        ↓
  Facts saved as "Needs Review"
        ↓
  ↑ YOU review & confirm each fact ↑
        ↓
  Confirmed facts → live business profile
  (public, verified, Google-friendly)
        ↓
  Monthly Re-scan → new facts → YOU review again
        ↓
  Munshee learns your preferences over time
```

**Autonomy Level (AI ka decision power):**
- **Level 0**: Read-only (AI dekhti hai, kaam nahi karti)
- **Level 1**: Self-mutation (AI re-scan karta hai, aap confirm karte hain) ← CURRENT
- **Level 2**: Outbound to merchant (AI WhatsApp kar sakti hai but you approve)
- **Level 3**: Drafts (AI likh legi but you send karo) 
- **Level 4**: Auto-send (AI khud bhej degi — ONLY after 90 days, 85% acceptance) 
- **Level 5**: NEVER for payments/orders — always your approval

### 🐛 Abhi tak ke problems (aur unki solutions)

```
┌─────────────────────────────────┬──────────┬─────────────────────────────┐
│ Problem                         │ Severity │ Status                      │
├─────────────────────────────────┼──────────┼─────────────────────────────┤
│ 3 vocab systems don't talk       │ Critical │ 0023b on disk, push pending  │
│ Re-scan only does 1 page         │ High     │ Task 0.2b ready, not started │
│ TEST guard in spec always fails  │ High     │ Needs UUID-based fix        │
│ 6+ hardcoded strings in UI       │ Medium   │ Can fix per-file            │
│ Broken � char in Urdu strings     │ Medium   │ Can fix in locale files      │
│ Missing Roman Urdu nav keys      │ Low      │ Easy to backfill            │
│ comet-stranger worktree orphan   │ Low      │ Just delete the folder      │
└─────────────────────────────────┴──────────┴─────────────────────────────┘
```

### 📋 Founder Checklist (Next 3 Steps)

1. **[YOU — 5 min]** Run `supabase db push` to apply migrations 0023 + 0023b
2. **[YOU — 10 min]** Run V1-V4 SQL verification queries (see §7 step 1)
3. **[KILO → YOU]** Then Kilo fixes the follow-up issues + Task 0.2b

> **🎯 Deployment kab tak band hai?** Jab tak 5 test merchants actively using nahi
> hain + Phase 1 features (digest, demo mode, WA parser, ROI ledger) complete nahi
> hote. Yeh lock 2026-09-09 ko lene waale founder ne diya hai.

---

## 📁 CODEBASE STRUCTURE REFERENCE (for AI agents)

```
munshee.pk/
├── src/
│   ├── features/
│   │   ├── extraction/      # ExtractTextPage, ExtractFactsPage, ExtractVisionPage
│   │   ├── billing/          # BillingPage, usePlans, pricing UI
│   │   ├── clients/          # Client management (expert mode)
│   │   ├── facts/            # Business facts review queue
│   │   ├── admin/            # Admin dashboard (payments, activations)
│   │   ├── reviews/          # Fact review & confirm/reject flows
│   │   ├── ask/              # Ask Munshee Q&A
│   │   ├── scraper/          # Website extraction (single-page — needs 0.2b)
│   │   ├── imports/          # CSV/WA import flows
│   │   └── auth/             # Signup, login, callback
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── agent-tools.ts    # v4 agent tool registry (extract_facts, ask_munshee, rescan)
│   │   ├── autonomy-service.ts # Kill switch + autonomy level checks
│   │   └── featureFlags.ts   # ⚠️ uses divergent vocabulary from DB
│   ├── data/
│   │   └── demo-business.ts  # Demo business data
│   ├── hooks/                # useFacts, useBusiness, useAuthUser, usePlans
│   └── i18n/
│       └── locales/
│           ├── en.json       # ✓ 150 actions (correct)
│           ├── ur.json       # ⚠️ � char at line 212, missing nav keys
│           ├── roman_ur.json # ⚠️ � char at line 212, missing 11 nav keys
│           └── en-PK.json    # ⚠️ � char at line 212
├── supabase/
│   ├── migrations/
│   │   ├── 0001-0019         # Core schema (applied)
│   │   ├── 0020              # Locked pricing (applied)
│   │   ├── 0022              # ⚠️ EMPTY (just \)
│   │   ├── 0023              # credit_ledger fix (on disk, NOT pushed)
│   │   ├── 0023b             # Vocabulary + log_vision_extraction (on disk, NOT pushed)
│   │   └── 00070001          # Old naming, valid (deduct_tenant_credits RPC)
│   └── functions/
│       ├── extract-facts/    # Edge function (uses direct action_ledger.insert + consume_action)
│       ├── extract-vision/   # ✓ Already uses log_vision_extraction RPC
│       ├── re-scan-business/ # ⚠️ Uses "rescan" singular (mismatch with 0023b)
│       └── ask-munshee/      # Real implementation (NOT a stub)
├── e2e/
│   ├── billing-gating.spec.ts    # ✓ Exists (report incorrectly called it billing-flow)
│   ├── happy-path.spec.ts
│   ├── auth.spec.ts
│   ├── admin-eval.spec.ts
│   └── prod-smoke.spec.ts
├── spec/
│   └── agent-primitives.spec.ts  # ⚠️ TEST guard broken (UUID startsWith check)
├── scripts/
│   └── check-i18n.mjs        # Checks key completeness across 4 locale files
├── docs/
│   ├── evidence/             # 7 evidence files (verified)
│   ├── DEPLOY-CHECKLIST.md
│   └── VISION.md             # LUMEN archived here
├── state.md                  # ← THIS FILE (was empty per v3, actually 44 lines — now replaced)
├── agent.md                  # Agent rules (v2 FINAL)
├── AGENTS.md                 # Agent rules (12 lines — TEST DATA RULE, i18n, etc.)
└── PROJECT-REPORT.md         # ← THIS FILE (v4 corrected)
```

### File priority for next Kilo tasks:
1. `supabase/migrations/0023b_vocabulary_unification_and_ledger_fixes.sql` — push to remote
2. `src/lib/featureFlags.ts` — unify vocabulary
3. `supabase/functions/re-scan-business/index.ts` — change "rescan" → "rescans"
4. `spec/agent-primitives.spec.ts` — fix broken TEST guard (line 68)
5. `src/i18n/locales/*.json` — fix � chars + roman_ur missing nav keys
6. Hardcoded strings in: BillingPage.tsx, ClientsPage.tsx, AdminPage.tsx, ImportNewPage.tsx, ReviewQueuePage.tsx, agent-tools.ts
7. `.kilo/worktrees/comet-stranger/` — delete
8. `supabase/migrations/0022_schema_reconciliation.sql` — add comment marking it as no-op placeholder
