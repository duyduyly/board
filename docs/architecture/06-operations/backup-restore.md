---
id: "OPS-BACKUP-RESTORE"
title: "Backup and Restore"
doc_type: how-to
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "User project data"
evidence_refs: ["EV-008", "EV-009", "EV-010", "EV-021", "EV-030"]
---

# Backup and Restore

The system keeps no data on a server. Users own their data as exported JSON files.

## Inventory

| Data | Where it lives | Backed up by | Evidence | Status |
|---|---|---|---|---|
| Project being edited | Browser memory | Nothing until exported; unload prompt warns | EV-021 | VERIFIED |
| Exported project | User's file system | The user (their own backups) | EV-010 | VERIFIED |
| Recovery snapshot (opt-in) | IndexedDB `card-atlas-recovery`, key `current` | Nothing; single latest copy | EV-008 | VERIFIED |
| Application code | git repository | git remote | — | INFERRED (a remote `origin` exists) |

## Restore procedure

1. **From an exported file:** *Nhập JSON* → choose the file → check the preview → *Áp dụng* (EV-009).
2. **From recovery:** reload the page with recovery enabled → accept the restore dialog, or use *Khôi phục* in the project menu (EV-008).
3. **Nothing exported and recovery off:** the work cannot be restored; there is no server copy by design (EV-030).
