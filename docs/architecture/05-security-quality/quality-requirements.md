---
id: "QUALITY-REQUIREMENTS"
title: "Quality Requirements"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-005", "EV-006", "EV-008", "EV-013", "EV-021", "EV-022", "EV-030"]
---

# Quality Requirements

## Quality goals (top 3–5, in priority order)

The owner has not stated quality goals; they are not derived from code. The candidates below are **INFERRED** from project rules and must be confirmed.

| ID | Quality (ISO 25010) | Candidate goal | Status |
|---|---|---|---|
| QG-01 | Reliability | No silent data loss: drafts guarded, one Undo per action, unload prompt | INFERRED (EV-005, EV-021) |
| QG-02 | Security | Untrusted files and HTML cannot run script | INFERRED (EV-013) |
| QG-03 | Portability / privacy | Works offline from static files; no upload or telemetry | INFERRED (EV-030) |
| QG-04 | Usability | Bilingual UI, keyboard reachable controls | INFERRED (EV-022) |

## Quality scenarios

| ID | Goal | Stimulus | Response (as-is) | Measure | Evidence | Status |
|---|---|---|---|---|---|---|
| QS-001 | QG-01 | User closes the tab with unexported changes | Browser asks to confirm leaving | Prompt shown | EV-021 | VERIFIED |
| QS-002 | QG-01 | Browser crashes with recovery on | Last snapshot (≤ 500 ms old) offered on next load | One snapshot | EV-008 | VERIFIED |
| QS-003 | QG-02 | File with `<script>` or event handlers is imported | Removed by the sanitizer and listed in the preview | Nothing runs | EV-013 | VERIFIED |
| QS-004 | QG-01 | Change would break the contract | Change refused, project unchanged | 0 invalid states stored | EV-005, EV-006 | VERIFIED |
| QS-005 | Performance | Project at the 500-card limit | UNKNOWN | `npm run benchmark` exists; no target or result recorded | — | UNKNOWN |
