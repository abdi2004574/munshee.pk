---
name: spec-driven
description: Spec-driven autonomous development. Interview → spec → decompose into DAG → execute in parallel → validate with independent critics → fold learnings back into doctrine. Use for multi-hour autonomous builds.
---
# Spec-Driven Development Skill

## Purpose
Enable autonomous multi-hour development cycles by transforming high-level requirements into a dependency-structured execution plan, dispatching parallel work, and validating every job with independent critics.

## The Loop

```
Interview → Spec → Decompose → Execute → Evaluate → Fold Learnings → Repeat
```

## Phase 0: Context Bootstrap
Before the interview, establish durable project doctrine:
- Read `agent.md`, `AGENTS.md`, `state.md` if they exist
- Scan existing codebase structure (brownfield) or defer to interview (greenfield)
- Write findings to `.kilo/project/overview.md`

## Phase 1: Interview
Ask clarifying questions to build a complete picture:
- What is the core problem being solved?
- Who are the users? What are their jobs-to-be-done?
- What does "done" look like? Define acceptance criteria.
- What are the constraints? (tech stack, timeline, budget, integrations)
- What existing systems must integrate with this?
- What is out of scope?

Capture the answers in `.kilo/project/interview.md`.

## Phase 2: Spec & Quality Contract
Write a formal spec with scenarios and a quality contract:

```markdown
# Spec: [Feature Name]

## Overview
[2-3 sentence description]

## User Stories
- As a [role], I want [action] so that [outcome]

## Acceptance Criteria
- [ ] Criterion 1 (testable, observable)
- [ ] Criterion 2 (testable, observable)
- [ ] Criterion 3 (testable, observable)

## Non-Functional Requirements
- Performance: [targets]
- Security: [requirements]
- Accessibility: [WCAG level]
- i18n: [languages needed]

## Quality Contract
- Typecheck must pass
- Lint must pass
- Unit tests must pass
- E2E tests must pass
- Build must succeed
```

Write the spec to `.kilo/project/spec.md`.

## Phase 3: Decomposition
Break the spec into a dependency graph (DAG) of jobs. Each job is a single, focused task:

```json
{
  "jobs": [
    {
      "id": "job-1",
      "title": "Set up database schema",
      "description": "Create the PostgreSQL tables for [entity]",
      "depends_on": [],
      "acceptance_criteria": ["Tables created", "RLS enabled", "Indexes defined"],
      "estimated_tokens": 5000
    },
    {
      "id": "job-2",
      "title": "Build API endpoints",
      "description": "Create the REST API for [entity]",
      "depends_on": ["job-1"],
      "acceptance_criteria": ["All endpoints return correct status codes", "Input validated with Zod"],
      "estimated_tokens": 8000
    }
  ]
}
```

Write the DAG to `.kilo/project/decomposition.json`.

### Granularity Rules
- **Frontier models**: Fewer, larger, goal-oriented jobs (5-10 jobs)
- **Local/free models**: Finer-grained, single-responsibility jobs with explicit acceptance criteria (15-30 jobs)
- Each job must be independently dispatchable and verifiable

## Phase 4: Execution Loop
For each job in topological order:
1. Inline the spec, decomposition, and any relevant context into the job prompt
2. Dispatch the job to an agent (use the Task tool with the appropriate subagent)
3. The agent must:
   - Read the relevant codebase files first
   - Write tests BEFORE implementing (TDD)
   - Implement the feature
   - Run typecheck + tests
   - Fix failures until green
   - Commit with a clear message
4. If the job fails after 3 retries, mark it as blocked and move to the next job

## Phase 5: Evaluation
After all jobs complete, dispatch independent critics:

### Grounded Critics (full context)
- Check conformance to the spec
- Verify acceptance criteria are met
- Review code quality, security, and design system conformance

### Ungrounded Critics (no spec context)
- Review independently
- Catch issues the spec itself missed
- Challenge assumptions

### Built-in Critics
1. **Code critic**: typecheck, lint, security, design system conformance
2. **Test critic**: test coverage, test quality, TEST DATA RULE enforcement
3. **Interaction E2E**: run Playwright specs against the built app

## Phase 6: Fold Learnings Back
At the end of the run:
1. Collect all drift notes (doctrine that no longer matches reality)
2. Consolidate proposals in `.kilo/project/proposals.md`
3. Apply accepted proposals to doctrine files
4. Re-run the bootstrap gate to keep doctrine coherent

## Safety Rules
- Never weaken RLS
- Never truncate/delete real data in tests
- Never install npm packages without approval
- Never use Gemini
- Never hardcode user-facing strings
- Always commit early and often (checkpoint commits)
- Always stop on a red flag (failing tests, typecheck errors, lint failures)
- Always set max iterations and max time limits to prevent runaway loops