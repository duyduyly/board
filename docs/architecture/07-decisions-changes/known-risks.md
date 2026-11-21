---
id: "DECISIONS-KNOWN-RISKS"
title: "Known Risks and Open Questions"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-002", "EV-005", "EV-006", "EV-008", "EV-010", "EV-014", "EV-021", "EV-028", "EV-029", "EV-030", "EV-036"]
---

# Known Risks and Open Questions

| Risk ID | Summary | Kind | Affected flow / doc | Impact | Likelihood | Evidence | Mitigation (To-Be) | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|
| R-03 | Work is lost if the tab or browser closes before export while recovery is off; export also marks the project saved even if the browser did not save the file | proven (no implicit storage); suspected (download result) | [Export](../03-workflows/forms/export-project.md), [Backup](../06-operations/backup-restore.md) | High | Medium | EV-010, EV-021, EV-030 | Offer recovery on first use; consider the File System Access API to save to a chosen file | UNKNOWN | OPEN |
| R-05 | The app page has no Content Security Policy; the HTML sanitizer is the only barrier against script in imported content | proven (CSP absent) | [Security Architecture](../05-security-quality/security-architecture.md) | High | Low | EV-002 | Add a page CSP allowing only same-origin scripts | UNKNOWN | OPEN |
| R-02 | About 104 E2E tests fail before any change, so regressions in editor, transfer, block format and Mind Map areas can go unnoticed | proven | [Test Strategy](../05-security-quality/test-strategy.md) | Medium | High | EV-036 | Investigate the shared cause of the timeouts; fix or quarantine with an owner | UNKNOWN | OPEN |
| R-01 | Development and tests run on Node.js 25, end-of-life since 2026-06-01 | proven | [Technology Stack](../00-overview/technology-stack.md) | Medium | High | EV-028, EV-029 | Move to Node 26 (Active LTS) or 24 and record it in the README | UNKNOWN | OPEN |
| R-04 | Opening a shared file loads every remote image automatically, telling those hosts the user's IP (tracking pixel) | proven | [Read a document](../03-workflows/events/read-document-media.md), [Data Flows](../04-data-integrations/data-flows.md) | Medium | Medium | EV-014 | Click-to-load images for imported files, as for video | UNKNOWN | OPEN |
| R-06 | A file that uses a newer optional field (for example group `parentId`) is rejected by an older version, because the contract version stays `1.0` and unknown fields are rejected | proven | [Import](../03-workflows/forms/import-project.md), [Rollback](../06-operations/rollback.md) | Medium | Low | EV-006 | Bump a contract or app version when fields are added; show which version wrote the file | UNKNOWN | OPEN |
| R-07 | The opt-in recovery snapshot is stored unencrypted in the browser profile | proven | [Recovery](../03-workflows/events/recovery-snapshot.md) | Low | Low | EV-008 | Document the risk next to the opt-in switch | UNKNOWN | OPEN |
| R-08 | Undo keeps 100 steps / 20 MiB and drops older steps without telling the user | proven | [User Action Lifecycle](../03-workflows/request-lifecycle.md) | Low | Medium | EV-005 | Show when history was trimmed | UNKNOWN | OPEN |

## Scales

| Field | Values |
|---|---|
| Kind | `proven` (evidence shows the weakness exists) · `suspected` (needs checking; say what would confirm it) |
| Impact | `High` — data loss, security breach, outage of a main flow · `Medium` — one feature degraded, manual workaround exists · `Low` — cosmetic or internal only |
| Likelihood | `High` — happens in normal operation or is easy to trigger · `Medium` — needs a specific but plausible condition · `Low` — rare condition · `UNKNOWN` |
| Status | `OPEN` · `MITIGATED` · `ACCEPTED` · `CLOSED` |

## Open questions

| Question | Why it matters | How to verify | Owner |
|---|---|---|---|
| Who owns Card Atlas and reviews these docs? | Nobody can accept risks or confirm goals | Ask the maintainer | UNKNOWN |
| Is the app hosted anywhere? | Hosting adds TLS, caching and CSP concerns not covered here | Ask; check any server outside the repo | UNKNOWN |
| What are the top quality goals? | Needed to rank risks and tests | Owner workshop | UNKNOWN |
| Which Node.js line to use? | R-01 | Decide and update README | UNKNOWN |
| Are the failing E2E tests accepted? | R-02 | Owner decision per spec | UNKNOWN |
