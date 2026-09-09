# AGENTS.md — Munshee.pk Coding Agent Rules

## TEST DATA RULE
Never TRUNCATE/DELETE real data in tests. Tests run against dedicated TEST- prefixed tenant only. spec files must assert TEST_TENANT_ID guard before any delete.

## General Rules
- All user-visible strings must use i18next keys (en.json, ur.json, roman_ur.json, en-PK.json).
- Never hardcode strings in components.
- Supabase migrations are append-only — never edit old migrations.
- RLS must never be weakened.
- No Gemini usage anywhere.
- Never install npm packages without explicit approval.