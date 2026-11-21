---
id: "ARCH-SOLUTION-STRATEGY"
title: "Solution Strategy"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-003", "EV-005", "EV-007", "EV-013", "EV-018", "EV-019", "EV-030"]
---

# Solution Strategy

A summary of the decisions that shape Card Atlas. The rationale is `INFERRED` from code and project rules; the owner has not confirmed it.

## Fundamental decisions

| Decision | What it means in the code | ADR | Evidence |
|---|---|---|---|
| Static, backend-less app; the project is one JSON file | No server API; import/export through the File API; dev server serves files only | [ADR 0001](../07-decisions-changes/adr/0001-static-backendless-json-file.md) | EV-003, EV-030 |
| Strict JSON contract with namespaced extensions | Unknown fields rejected; new data only under `card-atlas:*` | [ADR 0002](../07-decisions-changes/adr/0002-namespaced-extensions-contract.md) | EV-007 |
| Sanitized HTML documents in a sandboxed frame | DOMPurify allowlist, script-less iframe, CSP | [ADR 0003](../07-decisions-changes/adr/0003-sanitized-html-sandboxed-frame.md) | EV-013 |
| Vendored libraries, no CDN | esbuild bundles into `assets/vendor/`, lazy chunks for heavy parts | [ADR 0004](../07-decisions-changes/adr/0004-vendored-libraries-no-cdn.md) | EV-018 |
| One store, one command per action | `ProjectStore.commit` with diff-based Undo | — (see [Cross-cutting Concepts](crosscutting-concepts.md)) | EV-005 |
| Vanilla ES modules with an enforced dependency direction | No framework; `npm run check` blocks cycles and imports of `app.js` | — | EV-019 |

## How the quality goals are addressed

Quality goals are not confirmed by the owner (see [Quality Requirements](../05-security-quality/quality-requirements.md)). The decisions above serve the goals inferred in [Scope and Goals](../00-overview/scope-and-goals.md): portability (one file, strict contract), privacy and offline use (no server, no CDN, no telemetry), safety with untrusted content (sanitizing and sandbox), and no silent data loss (one command per action, draft guards, opt-in recovery).
