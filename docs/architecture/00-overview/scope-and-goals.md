---
id: "OVERVIEW-SCOPE-AND-GOALS"
title: "Scope, Goals and Constraints"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-003", "EV-005", "EV-006", "EV-008", "EV-018", "EV-019", "EV-022", "EV-027", "EV-030"]
---

# Scope, Goals and Constraints

## Goals

Goals below are read from the README and project rules; the owner has not confirmed them, so each is `INFERRED`.

| Goal ID | Goal | Metric / acceptance criteria | Evidence |
|---|---|---|---|
| GOAL-001 | Let one person build a note graph and a knowledge map without an account or server | Works from a static server, no network call needed for core features | EV-003, EV-030 (INFERRED) |
| GOAL-002 | Keep the project portable and inspectable as one JSON file | Export → import round-trips; strict contract | EV-006 (INFERRED) |
| GOAL-003 | Never lose work silently | Drafts guarded, one Undo per action, unload prompt, opt-in recovery | EV-005, EV-008 (INFERRED) |
| GOAL-004 | Bilingual UI (Vietnamese default, English) | Every UI string through `t(key)` | EV-022 (INFERRED) |

## Non-goals

- No user accounts, sharing, collaboration or sync (no code for them).
- No automatic saving to the browser unless the user enables recovery (EV-008, EV-030).
- No mobile editing: the app targets desktop browsers (`.claude/rules/ux-ui.md` §14.1, INFERRED).

## Constraints

| Type | Constraint | Impact | Source |
|---|---|---|---|
| Technical | Static files only; must be served over HTTP, not `file://` | ES modules, `fetch` of templates and vendor chunks | `README.md`, EV-003 |
| Technical | No runtime CDN; libraries built locally | `npm run build` before first run | EV-018, EV-030 |
| Technical | Limits: 10 MiB file, 500 cards, 2,000 relations, 100,000 characters per card | Larger projects are rejected | EV-006 |
| Organizational | Project rules in `AGENTS.md`, `CLAUDE.md`, `.claude/rules/` | Architecture and UX gates on every change | EV-019, EV-030 |
| Regulatory | UNKNOWN | — | — |

## Assumptions

| Assumption | Owner | How to verify | Status |
|---|---|---|---|
| Users keep their own backups of exported files | UNKNOWN | Ask the owner | UNKNOWN |
| The app is only run locally | UNKNOWN | Ask the owner; no hosting config found (EV-027) | UNKNOWN |
