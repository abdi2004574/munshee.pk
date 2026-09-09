---
description: Run a comprehensive UI/UX review on the current codebase
agent: ux-reviewer
subtask: true
---
Run a full UI/UX review of the current codebase.

## Scope
- All `.tsx` files in `src/components/` and `src/features/`
- Design system conformance from `tailwind.config.ts`
- Accessibility (WCAG AA) checks
- Responsive behavior (mobile 375px, tablet 768px, desktop 1440px)

## Process
1. Read `tailwind.config.ts` and `src/styles/index.css` for design tokens
2. Read `agent.md` for design rules: no shadows, no gradients, 1px borders, rounded cards, Inter font
3. Scan each component file for:
   - Hardcoded strings (should use i18next)
   - Missing empty/loading/error states
   - Inconsistent border radius (should be md/lg/xl)
   - Missing focus states on interactive elements
   - Color contrast issues
   - Arbitrary Tailwind values (should use design tokens)
   - Inline styles (should use Tailwind classes)
4. Report findings by severity: BLOCKER / WARNING / SUGGESTION

## Output
A structured report with file paths, line numbers, severity, description, and fix suggestion for each finding.
