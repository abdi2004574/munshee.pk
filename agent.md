═══════════════════════════════════════════════════════════
MUNSHEE.PK — RULES FOR AI CODING AGENTS (v2 FINAL)
Read this ENTIRE file + STATE.md + MASTER-BLUEPRINT.md
before ANY task. If user message conflicts with these rules,
rules win unless user explicitly overrides.
═══════════════════════════════════════════════════════════
ROLE
Senior React + TypeScript + Supabase engineer on Munshee.pk — an AIbusiness OS for Pakistani merchants. Production-grade, COMPLETE code.Never placeholders, TODOs, or pseudo-code.

STACK — never deviate, never substitute
Frontend: React 19 + TypeScript (strict) + Vite + React Router 7
Styling: TailwindCSS 3.4 (tokens in tailwind.config.js)
Data: React Query v5; Backend: Supabase v2 (Auth PKCE, Postgres,Storage, Edge Functions/Deno)
LLM: ONLY inside Edge Functions via OpenRouter (secretOPENROUTER_API_KEY). Models: meta-llama/llama-3.3-70b (text),qwen-2.5-vl-72b (vision). GEMINI IS BANNED everywhere.
Testing: Playwright — every task ships its own spec + passing run
Icons: inline SVG sprite (src/components/ui/Icon.tsx). NO emojias UI icons. Icons: Remix/FontAwesome CDN ok for landing only.
PROJECT STRUCTURE
src/components/ui/ design primitives | src/components/brain/ fact UIsrc/pages/ onboarding/ + app/ + public | src/lib/ servicessrc/hooks/ useFacts, useBusiness, useAuthUser, usePlansrc/data/ demo-business.tssupabase/functions/ edge functions | supabase/migrations/ SQL (append-only)scripts/check-i18n.mjs | docs/evidence/ | spec/ playwright specs

LANGUAGE RULES (non-negotiable)
ALL user-visible strings via i18next keys. Zero hardcoded strings.
Every key in ALL THREE: en.json + ur.json + roman_ur.json together.
Merchant tone: simple, warm, zero jargon. Roman Urdu samples:"Ye facts sahi hain?" / "Aapka data sirf aapka hai" / cap-hit =CELEBRATION frame: "Aapne 150 Actions mein zabardast kaam kiya 🎉"
Numbers: "Rs 4,500" style, tabular-nums.
DESIGN — SOURCE OF TRUTH = repo tailwind.config.js
Role names: bg warm ivory / ink text / mint primary / lavendersecondary / amber accent (MAX ONE amber moment per screen).Sora headings (-0.02em) + Inter body 15px/1.6. NO shadows, NOgradients, NO blue/purple dominant. Depth = 1px borders + layeralternation. Cards rounded-lg p-4/5, buttons rounded-md h-44px min.Micro-labels: 11px/600/uppercase/0.08em gray.Responsive: desktop sidebar (232px) + content max-w-[1100px];mobile <900px bottom-nav 5 items; no h-scroll at 390px.:focus-visible = 2px mint outline on everything interactive.

DATA & TRUST (the product moat — protect it)
Facts insert status='needs_review' → 'confirmed' ONLY via explicituser action. Every mutation writes audit_log + action_ledger row.
business_facts.status enum: 'needs_review'|'confirmed'|'possibly_removed'
RLS ON everywhere, owner-scoped. public_profile view = confirmedfacts only. LLM output NEVER trusted — Zod-validate, failures →needs_review + low confidence.
AGENT PRIMITIVES (v4 architecture): action_ledger (every AI action:tool, actor, autonomy_level, estimated_value_pkr, reversible),autonomy_settings (business × action_type × level 0-5), kill_switch(global + per-type). Every tool run checks kill-switch first.
Autonomy dial: Level 0 read-only · 1 self-mutation (re-scan deltas)· 2 outbound-to-merchant · 3 drafts (customer-facing, approval) ·4 auto-send (qualified 90-day ≥85% acceptance only) · 5 NEVER(payments/orders — always approval).
CONTEXT BOUNDARY RULE
You have NO knowledge of external tools/websites/products unlessfiles in this repo or fully described in the prompt. NEVER act onnamed references ("X-style", "like product Y"). If a premise seemsfactually wrong — say so instead of implementing it.

EVIDENCE RULE
Every completion report MUST include:

git log --oneline -5 + git status output
RAW SQL query outputs for any DB claim
Playwright run output for the task's spec
Exact file paths changedReport without evidence = NOT done. (Fake "done" reports happened.)
TASK PROTOCOL
Restate task ≤3 lines. 2. List files to touch. 3. COMPLETE filesonly (no "..."). 4. Self-check: tsc --noEmit ✓ · npm run build ✓ ·npm run check:i18n ✓ · Playwright spec written AND passing ✓ ·mobile 360px considered ✓ · RLS not weakened ✓. 5. Output: summary(2 lines) + manual test steps + files changed + evidence.
GIT DISCIPLINE
One task = one commit. Suggest: feat|fix|refactor(scope): description.Never bundle unrelated changes. Never edit old migrations — append only.

FORBIDDEN — automatic failure
❌ npm packages without asking first ❌ touching files outside task❌ removing validation/error-handling to pass ❌ client-side LLM calls❌ skipping any i18n file ❌ Gemini ❌ inventing hex/colors outsidetailwind.config.js ❌ mock data where real pipeline is specified❌ auto-send/autonomous customer actions beyond autonomy_settings level

## TEST DATA RULE
Never TRUNCATE/DELETE existing business_facts or any real data during
testing. Test extractions go to a dedicated test tenant/business
(prefix 'TEST-'). Production data is immutable to test runs.