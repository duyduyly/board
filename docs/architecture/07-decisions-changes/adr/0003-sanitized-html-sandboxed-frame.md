---
id: "ADR-0003"
title: "ADR 0003 — Sanitized HTML Documents in a Sandboxed Reading Frame"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Decision: rich note content"
evidence_refs: ["EV-012", "EV-013", "EV-015", "EV-016", "EV-026"]
adr_status: accepted
origin: recovered
date: null
decision_makers: []
consulted: []
informed: []
---

# ADR 0003 — Sanitized HTML Documents in a Sandboxed Reading Frame

## Context and problem statement

Notes need rich content (headings, tables, cards, code, diagrams, video) that people and AI agents can produce as HTML. How can that HTML be shown without letting it run script?

## Decision drivers

- Imported files and pasted HTML are untrusted (QG-02, inferred).
- Content should look like Bootstrap documents and follow the app theme.

## Considered options

1. HTML stored as a sanitized component tree (`html-bs5`), rendered in a sandboxed iframe (chosen).
2. Markdown with Mermaid, the earlier format; still readable as legacy and converted by a script (EV-026).

## Decision outcome

Chosen option 1. HTML is reduced by a DOMPurify allowlist and stored as a component tree (EV-012); the reading view renders it as `srcdoc` in an iframe without `allow-scripts` and with CSP `default-src 'none'` (EV-013). Features that need script run in the parent page and insert sanitized results: Mermaid SVG (EV-015) and the YouTube player overlay (EV-016). Rationale status: `INFERRED`.

### Consequences

- Good, because script in content cannot run in the reading view.
- Good, because the stored document is always in the allowed subset.
- Bad, because interactive Bootstrap components (accordion, tabs) cannot work.
- Bad, because the iframe is same-origin; isolation depends on never adding `allow-scripts`.

### Confirmation

Playwright specs for sanitizing, Mermaid and video (`tests/mermaid-reading.spec.mjs`, `tests/video-reading.spec.mjs`, `tests/block-html-import.spec.mjs`).

## More information

Evidence: EV-012, EV-013, EV-015, EV-016, EV-026. Related: [Security Architecture](../../05-security-quality/security-architecture.md).
