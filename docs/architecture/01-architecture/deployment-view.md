---
id: "ARCH-DEPLOYMENT-VIEW"
title: "Deployment View"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Runtime placement"
evidence_refs: ["EV-003", "EV-008", "EV-027", "EV-028"]
---

# Deployment View

**Purpose:** Where does each container run today?

**Scope:** Deployment · local development (the only environment found) · audience: developer, operator.

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "step"}}}%%
flowchart LR
  accTitle: Deployment of Card Atlas on a developer machine
  accDescr: On one computer, a Node dev server serves the static files on 127.0.0.1 port 4173 to a desktop browser, which runs the app and keeps optional recovery data in IndexedDB.
  subgraph PC["Developer computer"]
    NODE["Dev server · Node 25.8.2"] -->|"serves files · HTTP 127.0.0.1:4173"| BR["Desktop browser"]
    BR -->|"runs"| APP["Browser App"]
    APP -->|"stores snapshot · IndexedDB"| REC[("Recovery Store")]
  end
  class APP accent

  classDef default fill:#FFFFFF,stroke:#64748B,color:#111827
  classDef accent fill:#DBEAFE,stroke:#1E40AF,color:#111827
  style PC fill:#FFFFFF,stroke:#94A3B8,color:#111827
```

**Explanation:** `npm run dev` starts `scripts/serve.mjs`, which binds 127.0.0.1:4173, serves only `/`, `/index.html` and `/assets/…`, and sends `Cache-Control: no-store` (EV-003). The browser runs the app and, when recovery is on, keeps one snapshot in IndexedDB (EV-008). Nothing is reachable from other machines.

**Evidence:** EV-003, EV-008, EV-028 — status `VERIFIED`.

**Limitations / Unknowns:** No production or shared environment is defined in the repository (no CI, container or hosting files, EV-027). If the app is published as static files elsewhere, that host, its TLS and its caching are `UNKNOWN`.

**Related:** [Container View](container-view.md), [Environments](../06-operations/environments.md), [Build and Release](../06-operations/deployment.md).

| Node | Runs | Configured in | Evidence | Status |
|---|---|---|---|---|
| Developer computer | Node dev server, desktop browser (Chrome / Edge / Firefox) | `package.json` `dev`, `scripts/serve.mjs` | EV-003 | VERIFIED |
| Any other host | UNKNOWN | — | EV-027 | UNKNOWN |
