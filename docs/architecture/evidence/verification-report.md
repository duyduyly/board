---
id: "EVIDENCE-VERIFICATION-REPORT"
title: "Verification Report"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-029", "EV-036", "EV-040"]
---

# Verification Report

| Run | Date | Revision | Scope | Method | Result |
|---|---|---|---|---|---|
| VER-001 | 2026-11-21 | 22407c017fffc2a2b6c774878dfd77ec991f91d6 | Whole kit, first write (checklist-auto) | Read source, config and project docs; `npm test` (EV-040); Node release pages opened (EV-029); repository search for CI and hosting files | 41 evidence rows; docs written for 38 checklist items, 6 marked not applicable |

## Coverage

- Read in source: `index.html`, `scripts/serve.mjs`, `scripts/build.mjs`, `scripts/architecture.mjs`, `scripts/convert-markdown-files.mjs`, `assets/js/app.js` (main paths), `store/`, `json/validator.js`, `json/schema.js`, `json/selection-export.js`, `detail/html-content.js`, `detail/mermaid-render.js`, `detail/video-embed.js`, `graph/card-groups.js`, `graph/mind-map.js`, `ui/chatgpt-launcher.js`, `ui/template-gallery.js`.
- Not read line by line: most of `canvas/`, `detail/block-editor.js` internals, `ui/format-inspector.js`, CSS beyond theme selectors. Claims about them stay at the level of module purpose.
- Diagrams: 18, linted with `check_mermaid.py` (0 errors, 0 warnings) and rendered with the bundled Mermaid 12.3.0 in Chrome (light and dark); GitHub's renderer was not used.
- E2E was **not** re-run at this revision; EV-036 is from 2026-11-14 at `c13a2a6`.

## Changes since the previous verification (update / audit runs)

None: first run.

## Claims needing follow-up

| Claim | Why | How to resolve |
|---|---|---|
| Quality goals QG-01…QG-04 | Inferred, not stated by the owner | Owner confirms or replaces them |
| E2E health (EV-036) | Local, git-ignored logs; older revision | Re-run the suite at the current revision and commit a summary |
| Hosting / production environment | No configuration in the repository | Owner answers whether and where the app is published |
| GrapesJS editor canvas isolation | Not reviewed | Read the iframe settings GrapesJS uses for its canvas |
| Library maintenance and end-of-life | Not looked up | Check each package's release page |
