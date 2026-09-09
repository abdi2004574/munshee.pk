---
description: Extract, validate, and document design tokens from the codebase
agent: ux-reviewer
subtask: true
---
Manage and validate design tokens.

## Source of Truth
`tailwind.config.ts` — the single source of truth for all design tokens.

## Process
1. Read `tailwind.config.ts` and extract all design tokens:
   - Colors (brand, accent, surface, ink, success, warning, danger)
   - Border radius (md, lg, xl)
   - Font families (sans)
   - Spacing (Tailwind default 4px grid)
2. Read `src/styles/index.css` for any custom CSS variables or overrides
3. Scan all components for:
   - Arbitrary Tailwind values (e.g., `w-[333px]`, `text-[14px]`) — these should use design tokens
   - Hardcoded colors that don't exist in the token set
   - Inconsistent spacing that breaks the 4px grid
4. Generate a design token documentation table

## Output
- Complete token inventory
- List of violations (arbitrary values, missing tokens)
- Recommended new tokens if gaps are found
- A copy-pasteable token reference for the team
