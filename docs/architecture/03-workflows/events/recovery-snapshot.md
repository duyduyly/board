---
id: "WORKFLOW-RECOVERY-SNAPSHOT"
title: "Workflow — Opt-in Recovery Snapshot"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Workflow: recovery snapshot save and restore"
evidence_refs: ["EV-006", "EV-008"]
---

# Workflow — Opt-in Recovery Snapshot

**Trigger:** any render while recovery is enabled; page load · **Entry point:** `scheduleRecovery()` (line 1905) and `initializeRecovery()` (line 2011) in `assets/js/app.js`

## Overview

**Purpose:** When is a recovery copy written, and how is it offered back?

**Scope:** Workflow · recovery · audience: developer, operator.

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "step"}}}%%
flowchart LR
  accTitle: Recovery snapshot
  accDescr: After a change, a timer writes one snapshot to IndexedDB if recovery is on; on the next page load the snapshot is offered for restore.
  T(["Project changed"]) --> ON{"Recovery enabled?"}
  ON -->|"no"| E1(["Nothing stored"])
  ON -->|"yes"| W["Wait 500 ms"]
  W -.->|"timer fires"| SV["Write snapshot"]
  SV --> SZ{"Within 20 MiB?"}
  SZ -->|"no"| E2(["Status: recovery error"])
  SZ -->|"yes"| OK(["Status: saved"])
  L(["Next page load"]) --> RD["Read snapshot"]
  RD --> RS["Offer restore dialog"]
  RS --> ST["stage and replace"]
  class T accent

  classDef default fill:#FFFFFF,stroke:#64748B,color:#111827
  classDef accent fill:#DBEAFE,stroke:#1E40AF,color:#111827
```

**Explanation:** Recovery is off by default; turning it on sets a `localStorage` flag, turning it off deletes the IndexedDB database (EV-008). With recovery on, each change resets a 500 ms timer that writes one snapshot under the key `current` (dashed: deferred). A snapshot over 20 MiB is refused with a status message. On the next load the snapshot is offered; restoring stages it like an import (EV-006) and replaces the project.

**Evidence:** EV-006, EV-008 — status `VERIFIED`.

**Limitations / Unknowns:** Only the latest snapshot is kept. Browser storage can be cleared by the browser or the user; nothing warns about that.

**Related:** [Backup and Restore](../../06-operations/backup-restore.md), [Data Flows](../../04-data-integrations/data-flows.md).

## Step fails → symptom → check

| Step | Function / route | Fails how | Symptom | Check | Evidence | Status |
|---|---|---|---|---|---|---|
| Write | `saveRecovery` | Over 20 MiB, quota, private mode | Toast and status "recovery error" | Browser storage settings | EV-008 | VERIFIED |
| Read | `readRecovery` | Database blocked or cleared | No restore offered | Was recovery on before? | EV-008 | VERIFIED |
| Restore | `stage` | Snapshot invalid | Restore refused | Export manually next time | EV-006 | VERIFIED |
