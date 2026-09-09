---
description: Check i18n compliance — no hardcoded strings, all keys present
agent: i18n-guard
subtask: true
---
Check i18n compliance across the codebase.

## Process
1. Run `npm run check:i18n` to execute the existing i18n validation script
2. Scan all `.tsx` and `.ts` files in `src/` for hardcoded user-facing strings
3. Check that all locale files (`en.json`, `ur.json`, `roman_ur.json`, `en-PK.json`) have matching keys
4. Flag any missing keys or orphaned keys

## Rules
- User-facing strings in JSX text, props (placeholder, title, aria-label), toast messages, and error messages MUST use i18next keys
- Ignore: TypeScript types, interfaces, enum names, variable names, import paths, CSS values, console.log messages, API paths, database column names, comments

## Output
- List of hardcoded strings with file, line, and suggested key
- Missing keys in each locale file
- Overall pass/fail status