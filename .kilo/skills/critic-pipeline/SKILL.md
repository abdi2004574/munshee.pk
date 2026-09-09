---
name: critic-pipeline
description: Independent adversarial evaluation. Dispatch critics with fresh context to validate work against spec and catch issues the author missed. Use after every job or feature completion.
---
# Critic Pipeline Skill

## Purpose
Every piece of work must be validated by an independent critic — an agent with fresh context, no access to the author's reasoning, and a mandate to find flaws.

## Why Critics Matter
The author of a solution is the worst possible evaluator. They have confirmation bias, sunk-cost bias, and tunnel vision. Independent critics with fresh context catch:
- Issues the spec itself missed
- Assumptions that were never stated
- Edge cases the author didn't consider
- Design system violations that slipped through
- Security issues that look obvious in hindsight

## Critic Types

### 1. Grounded Critic (`full_context: true`)
Has access to the spec, decomposition, and acceptance criteria.
- Checks conformance to the spec
- Verifies acceptance criteria are met
- Reviews code quality, security, and design system conformance
- **Limitation**: Can only find issues within the spec's frame

### 2. Ungrounded Critic (`full_context: false`)
No access to the spec or acceptance criteria.
- Reviews independently
- Catches issues the spec itself missed
- Challenges assumptions
- Explores edge cases freely
- **Strength**: Can find what the spec got wrong

### 3. Built-in Critics

#### Code Critic
- Run typecheck, lint, build
- Check for: null dereferences, race conditions, async errors
- Verify: RLS enforcement, input validation, error handling
- Check: design system conformance (no shadows, no gradients, token usage)
- Check: i18n compliance (no hardcoded strings)
- Check: accessibility (labels, focus states, ARIA)

#### Test Critic
- Run all tests (unit, integration, E2E)
- Check test coverage gaps
- Verify TEST DATA RULE enforcement
- Check: do tests actually test the right things, or are they trivially passing?
- Check: are there skipped tests that should run?

#### Interaction E2E Critic
- Run Playwright specs against the built app
- Navigate real user flows
- Verify: does the app actually work in a real browser?
- Check: are there visual regressions, broken layouts, unhandled errors?

## Critic Configuration

Create `.kilo/critics.json` to define custom critics:

```json
{
  "critics": [
    {
      "name": "code_critic",
      "type": "grounded",
      "checks": ["typecheck", "lint", "security", "design-system", "i18n", "accessibility"],
      "timeout": 300000
    },
    {
      "name": "test_critic",
      "type": "grounded",
      "checks": ["unit", "integration", "e2e", "coverage"],
      "timeout": 600000
    },
    {
      "name": "interaction_e2e",
      "type": "ungrounded",
      "checks": ["playwright", "visual", "navigation"],
      "timeout": 600000
    }
  ]
}
```

## Running the Critic Pipeline

1. Dispatch each critic as an independent subagent (Task tool)
2. Each critic gets fresh context — no shared memory with the author
3. Critics write their findings to `.kilo/critics/<name>.md`
4. Consolidate findings into `.kilo/critics/consolidated.md`
5. Score the work: pass / pass-with-warnings / fail
6. If fail, dispatch a fix job with the critic's findings as context

## Output Format
For each finding:
- Severity: BLOCKER / WARNING / SUGGESTION
- File path and line number
- What's wrong
- How to fix (with code snippet if needed)
- Which critic check found it

## Rules
- Critics never modify code — they only report
- Critics never share context with the author
- Every BLOCKER must be fixed before the work is considered complete
- Critics run after every job, not just at the end
- If a critic finds the same issue twice, escalate to a WARNING
