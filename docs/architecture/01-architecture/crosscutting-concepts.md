---
id: "ARCH-CROSSCUTTING"
title: "Cross-cutting Concepts"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Browser App"
evidence_refs: ["EV-005", "EV-006", "EV-007", "EV-012", "EV-013", "EV-019", "EV-021", "EV-022", "EV-023", "EV-025", "EV-030", "EV-038", "EV-041"]
---

# Cross-cutting Concepts

| Concept | How it works | Where | Evidence | Status |
|---|---|---|---|---|
| Commands and Undo | Every user action that changes the project calls `change(mutator)` in `app.js` → `ProjectStore.commit`: clone, mutate, check pins, validate, store a diff. One action = one Undo step; history keeps 100 steps / 20 MiB and is cleared with a notice when one step is larger | `app.js` `change`, `store/project-store.js` | EV-005 | VERIFIED |
| Validation | Ajv schema plus semantic checks (ids, references, limits, extension rules) run on import and on every commit; invalid states never enter the store | `json/validator.js`, `json/schema.js` | EV-006, EV-007 | VERIFIED |
| Invariants | Pinned cards cannot change (checked in `commit`); groups: one group per card, max 3 levels | `graph/card-lock.js`, `graph/card-groups.js` | EV-023 | VERIFIED |
| Sanitizing | User HTML goes through a DOMPurify allowlist and is shown in a script-less sandboxed iframe with a strict CSP; Mermaid SVG is sanitized again | `detail/html-content.js`, `detail/mermaid-render.js` | EV-012, EV-013 | VERIFIED |
| Session state vs model | Selection, open dialogs, drafts, layout preview, copy buffer, locale and theme are session memory in `app.js`; never in the file, history or recovery | `app.js` | EV-025 | VERIFIED |
| Drafts | Detail, Format inspector and inline editors keep drafts; every close / switch path asks to apply, discard or keep; closing the tab asks while drafts or unexported changes exist | `app.js` `guardDraft`, `beforeunload` | EV-021 | VERIFIED |
| Errors and feedback | User errors show a translated toast, status line or dialog; no `alert()`; failed commits leave the project unchanged | `ui/feedback.js`, `ui/dialog-surface.js` | EV-038 | VERIFIED |
| i18n | Every UI string through `t(key)`; Vietnamese default, English; one global `#locale` selector; user content is never translated | `i18n/` | EV-022 | VERIFIED |
| Theming | Light "pencil notebook" theme and dark charcoal theme through CSS custom properties; documents follow the theme inside the frame | `assets/css/theme.css`, `document-content.css` | EV-041 | VERIFIED |
| Module boundaries | No import cycles, no imports of `app.js`, `common/` has no upward imports (enforced by `npm run check`) | `scripts/architecture.mjs` | EV-019 | VERIFIED |
| Logging / telemetry | None by policy; no analytics, no upload | `AGENTS.md` | EV-030 | VERIFIED |
| Configuration | No runtime configuration or environment variables; behavior is fixed in code | searched `assets/js`, `scripts` | — | VERIFIED (see evidence register rules) |

## Design constraints and trade-offs

- **Whole-project validation on every commit** keeps the file always valid but costs time on large projects; the 500-card limit keeps this bounded (EV-006).
- **History by diff, bounded by size** keeps Undo cheap but drops old steps silently beyond 100 / 20 MiB, with a toast only when a single step is too large (EV-005).
- **No implicit storage** protects privacy but means closing the tab without exporting loses work unless recovery is on (EV-021, EV-030).
