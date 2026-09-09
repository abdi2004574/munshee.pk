---
description: Run the full spec-driven autonomous development cycle
agent: orchestrator
subtask: true
---
Run a complete spec-driven autonomous development cycle.

## Process
1. **Interview**: Ask clarifying questions, capture in `.kilo/project/interview.md`
2. **Spec**: Write formal spec with acceptance criteria in `.kilo/project/spec.md`
3. **Decompose**: Break spec into dependency graph (DAG) in `.kilo/project/decomposition.json`
4. **Execute**: Dispatch each job to a specialized subagent in topological order
   - Parallel jobs run concurrently
   - Each job: read context → write tests → implement → run typecheck + tests → fix → commit
   - Max 3 retries per job before marking blocked
5. **Evaluate**: Run critic pipeline
   - Grounded critics check conformance to spec
   - Ungrounded critics catch what the spec missed
   - Consolidate findings in `.kilo/critics/consolidated.md`
6. **Fold Learnings**: Collect drift notes, consolidate proposals, apply accepted ones

## Safety Rules
- Never weaken RLS
- Never truncate/delete real data in tests
- Never install npm packages without approval
- Never use Gemini
- Never hardcode user-facing strings
- Always commit early and often
- Always stop on a red flag
- Set max iterations and time limits

## Output
- Phase-by-phase status
- Job completion table
- Critic scores
- Doctrine updates applied
- Remaining work
