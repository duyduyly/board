---
id: "ADR-0001"
title: "ADR 0001 — Static, Backend-less App with the Project as a JSON File"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Decision: runtime architecture and persistence"
evidence_refs: ["EV-002", "EV-003", "EV-008", "EV-010", "EV-030"]
adr_status: accepted
origin: recovered
date: null
decision_makers: []
consulted: []
informed: []
---

# ADR 0001 — Static, Backend-less App with the Project as a JSON File

## Context and problem statement

Card Atlas needs to let one person build and keep note graphs. Where should the application run and where should the project be stored?

## Decision drivers

- Privacy: no upload or analytics (EV-030).
- Work offline and from any static host.
- Portability: a project the user can keep, share and inspect.

Drivers are `INFERRED` from `AGENTS.md`, `CLAUDE.md` and the README.

## Considered options

`UNKNOWN` — no record of alternatives was found.

## Decision outcome

Chosen option: everything runs in the browser from static files; the project lives in memory and is saved as one JSON file through import and export. The dev server only serves files (EV-002, EV-003, EV-010). Browser storage is used only for an opt-in recovery snapshot (EV-008). Rationale status: `INFERRED`.

### Consequences

- Good, because there is no server to run, secure or pay for, and no account data.
- Good, because a project is a plain file that can be versioned and shared.
- Bad, because closing the tab without exporting loses work unless recovery is on (R-03).
- Bad, because there is no collaboration or sync between devices.

### Confirmation

Code review against `AGENTS.md` line 94; the dev server serves files only. No automated check forbids adding network calls.

## More information

Evidence: EV-002, EV-003, EV-008, EV-010, EV-030. Related: [ADR 0004](0004-vendored-libraries-no-cdn.md), [Known Risks](../known-risks.md).
