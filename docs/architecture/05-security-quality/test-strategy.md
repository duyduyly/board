---
id: "QUALITY-TEST-STRATEGY"
title: "Test Strategy"
doc_type: how-to
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-001", "EV-019", "EV-020", "EV-036", "EV-039", "EV-040"]
---

# Test Strategy

| Level | Tool | What it covers | Command | Evidence |
|---|---|---|---|---|
| Unit | `node --test` | Pure logic in `graph/`, `json/`, store, prompt sync (31 `*-core.test.mjs` files plus `core.test.mjs`) | `npm test` | EV-020 |
| Static | `node --check`, ESLint, architecture gate | Syntax, lint, no import cycles, no imports of `app.js`, `common/` boundary | `npm run check` | EV-019 |
| Types | TypeScript `tsc` | Contract types and the modules listed in `tsconfig.modules.json` | `npm run typecheck` | EV-039 |
| Format | Prettier | `index.html`, `assets/css`, `assets/js`, `scripts`, `tests` | `npm run format:check` | EV-020 |
| End-to-end | Playwright 1.64.0 | 120 specs driving visible controls in Chrome, Edge and Firefox, one worker, against the dev server | `npm run dev` then `npm run e2e` | EV-020 |
| Performance | `scripts/benchmark*.mjs` | Canvas, radial and Mind Map timings | `npm run benchmark` | EV-001 |

Rules from `CLAUDE.md`: E2E tests use only visible controls (no hidden events, no bypassing `inert`); tests are never weakened to pass; every change runs the four static gates plus the relevant specs.

## Current health

A full Chrome run on 2026-11-14 had **459 passed, 114 failed**; 104 failures already existed at the earlier baseline and are mostly 30-second timeouts waiting for a control (EV-036, `INFERRED` because the logs are local and the run was before this revision). Failing areas include `editor`, `transfer`, `block-format`, `mind-map` and `group-frames-routing`. Until these are fixed, those areas have little E2E protection; see [Known Risks](../07-decisions-changes/known-risks.md) R-02 and [Runbook: E2E timeouts](../06-operations/runbooks/e2e-timeouts.md). Unit tests pass at this revision: 179 tests, 0 failures (EV-040).
