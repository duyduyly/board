---
id: "ARCH-COMPONENT-INDEX"
title: "C4 L3 — Component Index"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "All containers"
evidence_refs: ["EV-008", "EV-018"]
---

# C4 L3 — Component Index

Component views exist only for containers with meaningful internal structure.

| Container | Component view | Why / why not | Status |
|---|---|---|---|
| Browser App | [Components of the Browser App](browser-app.md) | All product logic lives here | DRAFT |
| Static Files | none | A folder of files; its build is described in [Build and Release](../../06-operations/deployment.md) (EV-018) | NOT_APPLICABLE |
| Recovery Store | none | One IndexedDB object store with one key (`current`) (EV-008) | NOT_APPLICABLE |
