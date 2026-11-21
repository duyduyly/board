---
id: "ADR-0002"
title: "ADR 0002 — Strict JSON Contract with Namespaced Extensions"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Decision: project file contract"
evidence_refs: ["EV-005", "EV-006", "EV-007"]
adr_status: accepted
origin: recovered
date: null
decision_makers: []
consulted: []
informed: []
---

# ADR 0002 — Strict JSON Contract with Namespaced Extensions

## Context and problem statement

Project files are produced by the app, by people and by AI agents. How strict should the format be, and where do new features put their data?

## Decision drivers

- Files from outside must not be able to put the app into an invalid state.
- New features (groups, Mind Map views, documents, images, appearance) need room to grow.

Drivers are `INFERRED`.

## Considered options

`UNKNOWN`.

## Decision outcome

Chosen option: a core contract 1.0 (`version`, `metadata`, `canvas`, `cards`, `relations`) where unknown fields are rejected, plus namespaced `card-atlas:*` extension objects on the project, cards and relations, each with its own schema (EV-007). The same validation runs on import and on every commit (EV-005, EV-006). Rationale status: `INFERRED`.

### Consequences

- Good, because every stored state is valid and errors point to a JSON path.
- Good, because features stay isolated in their namespace.
- Bad, because an older app rejects a file that uses a newer optional field; the version stays `1.0` (R-06).
- Bad, because the schema exists twice (DEBT-004).

### Confirmation

`tests/core.test.mjs` compares `json/schema.js` with `assets/data/project.schema.json`; round-trip and validator tests in `tests/*-core.test.mjs`.

## More information

Evidence: EV-005, EV-006, EV-007. Related: [Data Model](../../04-data-integrations/data-model.md).
