---
name: documentation
description: Generate and maintain project documentation, READMEs, API docs, and architecture decision records. Use when creating docs, updating docs, or documenting new features.
---
# Documentation Skill

## Purpose
Produce clear, maintainable documentation that stays accurate as the code evolves.

## Documentation Types

### 1. README
- Project overview and value proposition
- Tech stack table
- Quick start guide
- Environment setup
- Deployment instructions

### 2. API Documentation
- Endpoint list with HTTP methods
- Request/response schemas
- Authentication requirements
- Error codes

### 3. Architecture Decision Records (ADRs)
- Context: what problem are we solving?
- Decision: what did we choose?
- Consequences: what are the trade-offs?

### 4. Migration Guides
- What changed and why
- Step-by-step upgrade instructions
- Breaking changes with examples

## Rules
- Keep docs in `docs/` directory
- Use Markdown with clear headings
- Include code examples for setup instructions
- Document all environment variables
- Update docs when code changes
- Never document internal implementation details that can be inferred from code

## Project Documentation Structure
```
docs/
├── DEPLOY-CHECKLIST.md
└── evidence/
    ├── 01_rls_negative.md
    ├── 02_audit_immutable.md
    ├── 03_restore_test.md
    ├── 04_migrations_non_destructive.md
    ├── 05_secrets_audit.md
    ├── 06_git_evidence.md
    └── 07_eval_weekly.md
```

## Output Format
- Clear headings and subheadings
- Code blocks with language tags
- Tables for structured data
- Bullet points for lists
- Consistent formatting throughout