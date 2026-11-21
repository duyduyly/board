---
id: "WORKFLOW-APPLY-NOTE-DOCUMENT"
title: "Workflow — Edit and Apply a Note Document"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Workflow: Detail editor → Apply"
evidence_refs: ["EV-005", "EV-006", "EV-012", "EV-023", "EV-034"]
---

# Workflow — Edit and Apply a Note Document

**Trigger:** *Áp dụng* (Apply) in the Detail editor tab · **Entry point:** `form.onsubmit` in `assets/js/app.js` (line 1409) → `applyDraft()` (line 1529)

## Overview

**Purpose:** How does an edited note document become part of the project, and when is it refused?

**Scope:** Workflow · Detail editor · audience: developer.

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "step"}}}%%
flowchart LR
  accTitle: Apply a note document
  accDescr: The editor flushes its content into the draft, then the draft is checked for pins, form validity, fit and the whole project is validated before one commit.
  T(["Apply clicked"]) --> FL{"Editor flush ok?"}
  FL -->|"no"| E1(["Stay, notice shown"])
  FL -->|"yes"| PN{"Card pinned?"}
  PN -->|"yes"| E2(["Toast pinned locked"])
  PN -->|"no"| FIT{"Fit size ok?"}
  FIT -->|"no"| E3(["Stay, fit error"])
  FIT -->|"yes"| VAL{"Project valid?"}
  VAL -->|"no"| E4(["Stay, errors listed"])
  VAL -->|"yes"| CM["One commit"]
  CM --> OK(["Detail closes, toast"])
  class T accent

  classDef default fill:#FFFFFF,stroke:#64748B,color:#111827
  classDef accent fill:#DBEAFE,stroke:#1E40AF,color:#111827
```

**Explanation:** While the user edits, the block editor (GrapesJS, or CodeMirror in HTML code mode) writes the sanitized document, its plain text and any image attachments into the draft (`mountBlockEditor` callback, EV-034, EV-012). Apply first asks the editor to flush; HTML code mode refuses when the source still has removed parts. Then `applyDraft` refuses pinned cards (EV-023), checks the form, measures fit size when the card is in fit mode, validates a full copy of the project (EV-006), and commits once, so the whole edit is one Undo step (EV-005). On success the Detail dialog closes with a success toast.

**Evidence:** EV-005, EV-006, EV-012, EV-023, EV-034 — status `VERIFIED`.

**Limitations / Unknowns:** A pending HTML import or sample preview inside the editor is not part of the draft until the user adds it.

**Related:** [User Action Lifecycle](../request-lifecycle.md), [Read a Document](../events/read-document-media.md).

## Step fails → symptom → check

| Step | Function / route | Fails how | Symptom | Check | Evidence | Status |
|---|---|---|---|---|---|---|
| Flush | `blockEditor.flush` | HTML code has unsupported parts | Notice "HTML code rejected" | Remove the listed parts | EV-012 | VERIFIED |
| Pin | `applyDraft` | Card is pinned | Toast | Unpin first | EV-023 | VERIFIED |
| Fit | `measureOverview` | Content does not fit | "fit overflow" message | Shorter text or manual size | EV-005 | VERIFIED |
| Validate | `validate` | Limit or rule broken (e.g. 100,000 characters) | Errors in the form | Error paths | EV-006 | VERIFIED |

## Preconditions, authentication, idempotency

No authentication. Applying an unchanged draft adds no Undo step.
