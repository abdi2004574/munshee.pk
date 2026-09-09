---
name: project-memory
description: Self-healing project memory. Maintain durable project doctrine that updates itself as the codebase evolves. Use for cross-session continuity and knowledge accumulation.
---
# Project Memory Skill

## Purpose
Maintain durable project truth that stays current across sessions, agent runs, and team members. Project memory is not a chat log — it's a living document that heals itself.

## Memory Layers

### Layer 1: Permanent Doctrine (`.kilo/project/`)
These files are the source of truth. They never get deleted, only updated.

| File | Contents |
|---|---|
| `overview.md` | What this project is, what problem it solves, who uses it |
| `architecture.md` | System architecture, data flow, component boundaries |
| `product.md` | Product roadmap, features, user journeys |
| `testing.md` | Test strategy, test data rules, CI pipeline |
| `design.md` | Design system, tokens, accessibility requirements |

### Layer 2: Session Knowledge (`.kilo/project/knowledge/`)
Per-session knowledge that may be promoted to doctrine if validated.

| File | Contents |
|---|---|
| `decisions.md` | Architecture decisions made in this session, with rationale |
| `bugs.md` | Bugs found and fixed, with root cause |
| `patterns.md` | Reusable patterns discovered, with examples |

### Layer 3: Transient Notes (`.kilo/project/notes/`)
Scratch space. Never promoted without review.

## Self-Healing Process

### Step 1: Detect Drift
After each code change, check if doctrine still matches reality:
- Read the relevant doctrine file
- Compare against the actual codebase
- If they disagree, flag as a **drift note**

### Step 2: Consolidate Proposals
At the end of each session:
- Collect all drift notes into `.kilo/project/proposals.md`
- Group by theme (schema changes, API changes, design changes)
- Score each proposal: does it improve correctness, maintainability, or performance?

### Step 3: Apply Accepted Proposals
- Review proposals with the user (or autonomously if autonomy level allows)
- Apply accepted proposals to doctrine files
- Update the codebase if the proposal requires code changes
- Re-run the bootstrap gate to verify coherence

### Step 4: Bootstrap Gate
Before any new session, verify doctrine is coherent:
- Read all doctrine files
- Check for contradictions between files
- Check for stale information (referenced files that no longer exist, APIs that have changed)
- If incoherent, halt and report — don't start working on stale doctrine

## Memory Persistence

### Cross-Session Memory
Use the NEXUS MCP server (if available) or the built-in `kilo_memory_save`/`kilo_memory_recall` tools:
- Save: `kilo_memory_save({ namespace: "project", key: "schema_version", value: "0023" })`
- Recall: `kigo_memory_recall({ namespace: "project", key: "schema_version" })`

### Namespaces
| Namespace | What to store |
|---|---|
| `project` | Schema versions, API contracts, configuration |
| `decisions` | Architecture decisions with rationale |
| `bugs` | Root cause analysis of bugs |
| `patterns` | Reusable code patterns |
| `lessons` | What worked and what didn't |

## Rules
- Doctrine files are the source of truth — code follows doctrine, not the other way around
- Never delete doctrine files — they're an audit trail
- Never write to doctrine without a drift note or user approval
- Always validate doctrine against the actual codebase before using it
- If doctrine and code disagree, trust the code and flag the drift