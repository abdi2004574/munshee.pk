---
description: Bootstrap project doctrine — establish durable project truth before starting work
agent: orchestrator
subtask: true
---
Bootstrap project doctrine for the current project.

## Process
1. Read existing doctrine files in `.kilo/project/` if they exist
2. Scan the codebase structure (brownfield) or prepare for interview (greenfield)
3. Write findings to `.kilo/project/overview.md`:
   - What this project is
   - What problem it solves
   - Who uses it
   - Tech stack
4. Write to `.kilo/project/architecture.md`:
   - System architecture
   - Data flow
   - Component boundaries
   - Integration points
5. Check for contradictions between doctrine files
6. Check for stale information (referenced files that no longer exist, APIs that have changed)
7. If incoherent, halt and report — don't start working on stale doctrine

## Output
- Bootstrap gate result: PASS / FAIL
- List of incoherent or stale items
- Recommended next step
