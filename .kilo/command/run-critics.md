---
description: Run the full critic pipeline on the current codebase
agent: orchestrator
subtask: true
---
Run the independent critic pipeline against the current codebase.

## Process
1. Read `.kilo/critics.json` for critic configuration
2. For each critic in the config:
   - Dispatch as an independent subagent (Task tool)
   - Grounded critics get full context (spec, acceptance criteria)
   - Ungrounded critics get no spec context
   - Each critic writes findings to `.kilo/critics/<name>.md`
3. Consolidate all findings into `.kilo/critics/consolidated.md`
4. Score the work: pass / pass-with-warnings / fail

## Critic Types
- **code_critic**: typecheck, lint, security, design-system, i18n, accessibility
- **test_critic**: unit, integration, e2e, coverage, test-data-rule
- **interaction_e2e**: playwright, visual, navigation
- **security_critic**: rls, sql-injection, secrets, input-validation, tenant-isolation
- **design_critic**: design-system, accessibility, contrast, responsive

## Output
- Per-critic findings with severity (BLOCKER / WARNING / SUGGESTION)
- Consolidated score
- List of BLOCKERs that must be fixed before the work is complete