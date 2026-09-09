---
name: code-review
description: Systematic code review for correctness, security, performance, and design system conformance. Use when reviewing PRs, new code, or refactoring.
---
# Code Review Skill

## Purpose
Perform systematic, adversarial code review that catches issues a fresh pair of eyes would find.

## Review Process

### 1. Correctness
- Does the code do what the spec/intent says?
- Are there off-by-one errors, null dereferences, or type mismatches?
- Are all async operations properly awaited?
- Are there race conditions in state updates?

### 2. Security
- Are there SQL injection vectors? (parameterized queries only)
- Is RLS properly enforced on all database operations?
- Are secrets leaked in code or logs?
- Are input validations in place for all user-supplied data?
- Is `business_id` / `tenant_id` properly scoped on every query?

### 3. Performance
- Are there N+1 query patterns?
- Are expensive operations memoized or debounced?
- Are large lists paginated?
- Are React components re-rendering unnecessarily?

### 4. Design System Conformance
- No box-shadows, no gradients
- All radius values are md (6px), lg (10px), or xl (14px)
- All colors reference Tailwind design tokens
- No arbitrary Tailwind values
- All spacing uses Tailwind utilities

### 5. Accessibility
- Form inputs have associated labels
- Interactive elements have visible focus states
- Color is never the only information carrier
- Toasts and dialogs announce themselves (aria-live)

### 6. i18n
- No hardcoded user-facing strings
- All text uses i18next keys

### 7. Project Conventions
- Follow `agent.md` rules
- Follow `AGENTS.md` rules
- Supabase migrations are append-only
- Never weaken RLS

## Output Format
For each finding:
- Severity: BLOCKER / WARNING / SUGGESTION
- File path and line number
- Description
- Suggested fix with code snippet