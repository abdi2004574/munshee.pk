---
name: testing
description: Test-driven development, test suite management, and Playwright E2E testing. Use when writing tests, debugging test failures, or setting up testing infrastructure.
---
# Testing Skill

## Purpose
Ensure all code ships with adequate test coverage. Integrate testing into the development loop.

## Test Pyramid
1. **Unit tests** — pure functions, hooks, utilities (fast, many)
2. **Integration tests** — API routes, database operations (medium, fewer)
3. **E2E tests** — full user flows via Playwright (slow, few)

## Project Testing Setup
- Framework: Playwright 1.62 (`@playwright/test`)
- Config: `playwright.config.ts`, `playwright.spec.config.ts`
- Specs: `e2e/` directory
- CI: `.github/workflows/ci.yml` runs typecheck + build + Playwright happy-path

## Testing Rules
1. **TEST DATA RULE**: Never TRUNCATE/DELETE real data in tests. Tests run against dedicated TEST- prefixed tenant only. Spec files must assert TEST_TENANT_ID guard before any delete.
2. Write tests BEFORE implementing features (TDD)
3. Run `npm run test:e2e` after every significant change
4. Run `npm run typecheck` before committing
5. Mock external dependencies (OpenRouter, Supabase Edge Functions) in unit tests
6. Use real Supabase test project for integration tests

## Test Categories
- `e2e/happy-path.spec.ts` — main user flows
- `e2e/auth.spec.ts` — login, signup, logout
- `e2e/billing.spec.ts` — plan gating, credits
- `e2e/admin-eval.spec.ts` — admin evaluation flows
- `e2e/prod-smoke.spec.ts` — production smoke tests
- `e2e/rescan-delta.spec.ts` — rescan feature tests
- `spec/agent-primitives.spec.ts` — agent architecture tests

## Testing Workflow
1. Identify what to test (unit/integration/E2E)
2. Write the test first
3. Run the test (it should fail)
4. Implement the feature
5. Run the test (it should pass)
6. Run full test suite to ensure no regressions