---
id: "DOCS-QUALITY-GATES"
title: "Quality Gates"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: []
---

# Quality Gates

Run on 2026-11-21 at revision `22407c0`. Q01, Q02, Q07, Q15 and Q16 are checked by `check_docs.py`; Q13 by `check_mermaid.py`; the rest by reading.

| Gate | Check | Result | Evidence |
|---|---|---|---|
| Q01 | Every doc has frontmatter with id, title, status, owner, source_revision, scope | PASS | `check_docs.py --repo`: 0 errors |
| Q02 | No `VERIFIED` claim without EV-ID and source reference | PASS | `check_docs.py` |
| Q03 | Every `UNKNOWN` / `INFERRED` stated with reason | PASS | Read while writing; reasons given inline or under Limitations |
| Q04 | C4 Context shows no controllers, modules or tables | PASS | [System Context](01-architecture/system-context.md) shows the user, the system and four outside systems |
| Q05 | C4 Container shows runnable apps and stores only; hosts and schedulers in deployment view | PASS | Dev server and machine are only in the [Deployment View](01-architecture/deployment-view.md) |
| Q06 | Mermaid renders in the target renderer (tool / version); images looked at, no overlap or clipping | PASS with limits | All 18 diagrams rendered without error by the bundled Mermaid 12.3.0 in Chrome (light and dark) and looked at; overlaps found in the container view, security view, lifecycle and reading sequences were fixed. Not rendered by GitHub; in a dark page the `neutral` theme gives low-contrast message text in sequence diagrams |
| Q07 | Relative links and file references resolve | PASS | `check_docs.py` |
| Q08 | APIs, cron jobs, hooks and events checked in source/config | PASS | No HTTP API, cron or worker exists; event-like flows (recovery timer, reading frame load) read in source |
| Q09 | No secrets, tokens, PII or sensitive config values | PASS | The app has no secrets or environment variables; no user data copied |
| Q10 | Runbooks have prerequisites, read-only diagnosis, mitigation, rollback, verification | PASS | Three runbooks in `06-operations/runbooks/` |
| Q11 | Feature inventory marks active / disabled / unknown | PASS | [Feature Inventory](02-features/feature-inventory.md): ACTIVE / OPT-IN / CLI |
| Q12 | Owner / reviewer confirmed the important points | SKIPPED | No owner identified; checklist mode was checklist-auto |
| Q13 | Mermaid lint (`check_mermaid.py`) has no ERROR; every WARN fixed or explained | PASS | 18 diagrams, 0 errors, 0 warnings |
| Q14 | Diagram audit lists every diagram; unimplemented steps carry a status suffix | PASS | Table below; manual and unknown steps marked in the release and migration diagrams |
| Q15 | EV-IDs exist in the register; no template placeholder left; every C4 arrow labeled | PASS | `check_docs.py`; C4 arrows read |
| Q16 | No stale evidence since its revision, or re-checked (`check_docs.py --repo`) | PASS | 0 stale rows |

## Diagram audit

| Diagram (file § heading) | Viewpoint | Scope | Evidence status | Finding | Action |
|---|---|---|---|---|---|
| [system-context.md](01-architecture/system-context.md) § C4 L1 | C4 L1 | Card Atlas | VERIFIED | Clean | kept |
| [container-view.md](01-architecture/container-view.md) § C4 L2 | C4 L2 | Inside the system | VERIFIED | Edges to image hosts and YouTube crossed labels | moved to System Context and Data Flows; listed in the table |
| [browser-app.md](01-architecture/components/browser-app.md) § C4 L3 | C4 L3 | Browser App | VERIFIED | Read-only calls into `graph/` and `json/` would clutter | omitted, stated in Explanation and table |
| [deployment-view.md](01-architecture/deployment-view.md) | Deployment | Developer machine | VERIFIED | Only local environment exists | kept; other hosts UNKNOWN under Limitations |
| [request-lifecycle.md](03-workflows/request-lifecycle.md) | Runtime sequence | Any project change | VERIFIED | Step badges covered self-message text | self-messages turned into notes; step table renumbered |
| [import-project.md](03-workflows/forms/import-project.md) | Workflow | Import | VERIFIED | Too wide in LR | switched to TB; R-06 at the error check |
| [export-project.md](03-workflows/forms/export-project.md) | Workflow | Export | VERIFIED / INFERRED | Download result not observed | R-03 branch at the last step; switched to TB |
| [apply-note-document.md](03-workflows/forms/apply-note-document.md) | Workflow | Apply | VERIFIED | Clean | kept |
| [read-document-media.md](03-workflows/events/read-document-media.md) | Runtime sequence | Reading view | VERIFIED | Note clipped; badge over self-message | shortened note with R-04; self-message turned into a note |
| [recovery-snapshot.md](03-workflows/events/recovery-snapshot.md) | Workflow | Recovery | VERIFIED | Dashed arrow = timer-deferred write | kept |
| [data-model.md](04-data-integrations/data-model.md) | ERD | Project contract | VERIFIED | Logical references only, stated | kept |
| [data-flows.md](04-data-integrations/data-flows.md) | Data flow | Project data | VERIFIED | Clean | kept |
| [security-architecture.md](05-security-quality/security-architecture.md) | Security | Trust boundaries | VERIFIED | B4 arrow cut a zone title in LR | switched to TB with spacing |
| [deployment.md](06-operations/deployment.md) | Release | Repo to app | VERIFIED / UNKNOWN | Commands in nodes | commands moved to the table; manual and UNKNOWN suffixes |
| [import-rejected.md](06-operations/runbooks/import-rejected.md) | Operations | Import errors | VERIFIED | Clean | kept |
| [app-does-not-load.md](06-operations/runbooks/app-does-not-load.md) | Operations | Loading | VERIFIED | Clean | kept |
| [e2e-timeouts.md](06-operations/runbooks/e2e-timeouts.md) | Operations | E2E | INFERRED | Cause unknown, stated | kept |
| [markdown-to-html-document.md](07-decisions-changes/migrations/markdown-to-html-document.md) | Operations workflow | Migration | VERIFIED | Long decision labels | shortened; size limit moved to Explanation |

## Definition of done

Frontmatter complete; right abstraction level; important claims evidenced; nothing sensitive; diagrams and links valid; gaps written down, not hidden. Not met yet: owner review (Q12).
