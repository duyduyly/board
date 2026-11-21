---
id: "ADR-0004"
title: "ADR 0004 — Vendored Libraries, No CDN"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Decision: third-party code delivery"
evidence_refs: ["EV-001", "EV-015", "EV-018", "EV-030"]
adr_status: accepted
origin: recovered
date: null
decision_makers: []
consulted: []
informed: []
---

# ADR 0004 — Vendored Libraries, No CDN

## Context and problem statement

The app uses several large libraries (Cytoscape, GrapesJS, CodeMirror, DOMPurify, Ajv, highlight.js, Mermaid). How should they reach the browser?

## Decision drivers

- No runtime CDN or third-party requests by default (EV-030).
- Work offline once the files are served.

## Considered options

`UNKNOWN`.

## Decision outcome

Chosen option: exact-pinned npm packages (EV-001) bundled by esbuild into `assets/vendor/` and committed, each with its licence file; heavy parts load lazily (highlight.js, Mermaid split into chunks, ELK layout stubbed out) (EV-015, EV-018). Rationale status: `INFERRED`.

### Consequences

- Good, because the app never depends on a CDN being reachable or trustworthy.
- Good, because library versions are reviewed with the code.
- Bad, because `assets/vendor/` is large and rebuilds create noisy diffs (DEBT-006).
- Bad, because updates require `npm run build` and a commit.

### Confirmation

`scripts/architecture.mjs` only allows imports of missing modules under `assets/vendor/`; code review. No automated check scans for CDN URLs.

## More information

Evidence: EV-001, EV-015, EV-018, EV-030. Related: [ADR 0001](0001-static-backendless-json-file.md), [Technology Stack](../../00-overview/technology-stack.md).
