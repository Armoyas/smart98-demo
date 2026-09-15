# Implementation Plan — Smart98 Demo

> 10 steps over ~7.5 days. Each step = tasks + files + test criteria + progress.

## Step 1 — Repo Fork & Setup (½ day)

- **Tasks**: create `smart98-demo` repo; mirror upstream `lobehub/lobe-chat`; setup CI, env, branch protection
- **Files**: `README.md`, `.env.example`, `docs/
- **Test**: repo clones; CI passes on `main`
- **Status**: ⏳ IN PROGRESS (repo created)

## Step 2 — Project Workspaces (1 day)

- **Tasks**: workspace CRUD, scenario grouping, share links
- **Files**: `src/workspaces/*`
- **Test**: create → share → reopen across sessions (SC-004)
- **Status**: ⬜ PENDING

## Step 3 — MCP Integration (1 day)

- **Tasks**: tool discovery, marketplace listing, chat invocation, result rendering
- **Files**: `src/mcp/*`
- **Test**: discover + invoke E2E (SC-001)
- **Status**: ⬜ PENDING

## Step 4 — Skill System (1 day)

- **Tasks**: skill registry CRUD, `@skill-name` parser, handler router
- **Files**: `src/skills/*`
- **Test**: 100% activation of defined skills (SC-002)
- **Status**: ⬜ PENDING

## Step 5 — Agent Module (1 day)

- **Tasks**: agent builder, autonomous runner, status/progress reporting
- **Files**: `src/agents/*`
- **Test**: autonomous task completes with structured report (SC-003)
- **Status**: ⬜ PENDING

## Step 6 — Labs Toggles (½ day)

- **Tasks**: toggles for all 9 features, persistence, alpha/beta labels
- **Files**: `src/labs/*`
- **Test**: toggles persist on reload (SC-005)
- **Status**: ⬜ PENDING

## Step 7 — Artifact Deployment (1 day)

- **Tasks**: artifact render → deploy → public URL
- **Files**: `src/artifacts/*`
- **Test**: public URL opens without auth (SC-007)
- **Status**: ⬜ PENDING

## Step 8 — Self-Evolving (1 day)

- **Tasks**: action capture, pattern detection, rule proposals, approval flow
- **Files**: `src/self-evolve/*`
- **Test**: ≥1 non-trivial rule from 10 runs (SC-006)
- **Status**: ⬜ PENDING

## Step 9 — Eval Cases (½ day)

- **Tasks**: save-turn-as-case, eval runner, pass/fail reporting
- **Files**: `src/eval/*`, `src/markdown/*`, `src/text-select/*`, `src/oauth/*`
- **Test**: deterministic pass/fail (SC-008)
- **Status**: ⬜ PENDING

## Step 10 — Polish & Integration (½ day)

- **Tasks**: cross-feature integration, performance, docs, demo script
- **Files**: `docs/demo-script.md`
- **Test**: full scenario walkthrough passes
- **Status**: ⬜ PENDING

---

## Constitution Checks (SDD principles)

| Principle | Status |
| --- | --- |
| 1. Write inverted plan (tests before code) | ✅ PASS |
| 2. Duplicate → mark & refactor | ✅ PASS |
| 3. Golden rule: use correct abstractions | ✅ PASS |
| 4. Plan with AI, code with AI | ✅ PASS |
| 5. No coding before writing & executing tests | ✅ PASS |
| 6. Stable by design (spec→test→code) | ✅ PASS |
