---
id: "OPS-ROLLBACK"
title: "Rollback and Recovery"
doc_type: how-to
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Application code"
evidence_refs: ["EV-006", "EV-018", "EV-027"]
---

# Rollback and Recovery

The app is static files with no database and no server state, so rolling back the app means serving an older revision of the files. User projects are files the users own and are not touched by a rollback.

## Trigger conditions

- A release breaks loading, import, export or editing.
- A file exported by a new version cannot be imported by the version users run (contract change).

## Procedure

1. Find the last good commit: `git log --oneline` (read-only).
2. Revert the bad commit on `main` with `git revert <sha>` (keeps history), or check out the good revision locally to test it first.
3. If `package.json` dependencies changed, run `npm ci && npm run build` so `assets/vendor/` matches (EV-018).
4. Run the checks in [Local Setup](local-setup.md) → Verification.
5. Publish the files the same way as a release (`UNKNOWN`, EV-027).

**Contract caution:** files that use a newer optional field (for example group `links` or `parentId`) are rejected by an older validator because unknown fields are not allowed (EV-006). Before rolling back past a contract change, tell users that files saved with the newer version may not open.

**Verification:** open a template, import a recent user file, edit a document, export.
