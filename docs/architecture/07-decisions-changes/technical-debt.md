---
id: "DECISIONS-TECH-DEBT"
title: "Technical Debt"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-004", "EV-007", "EV-018", "EV-019", "EV-028", "EV-036"]
---

# Technical Debt

| ID | Area | Symptom | Cost / impact | Proposed action (To-Be) | Evidence | Priority |
|---|---|---|---|---|---|---|
| DEBT-001 | `assets/js/app.js` | 2,776 lines holding session state, guards, import/export, recovery, groups, copy/paste and most UI wiring | Hard to review; every feature touches it; project rule CC-13 warns against growth | Move whole workflows (import/export, groups, copy/paste) into controllers with ports, keeping `app.js` as wiring | EV-004 | High |
| DEBT-002 | Module layering | `graph/` imports `json/validator.js` and `detail/attachments.js`; `json/` imports `detail/appearance.js` and `detail/attachments.js`; `ui/card-list.js` imports search helpers from the store | Lower layers depend on presentation modules; the gate does not catch it because it only checks cycles, `app.js` and `common/` | Move the shared constants and checks (`IMAGE_NAMESPACE`, appearance issues, search) to `graph/` or `common/`; extend `scripts/architecture.mjs` with the layer order | EV-019 | Medium |
| DEBT-003 | E2E suite | About 104 failing tests before any change | Little protection in several areas; every change needs a baseline comparison | See R-02 | EV-036 | High |
| DEBT-004 | Contract | Two copies of the schema (`json/schema.js`, `assets/data/project.schema.json`) kept equal by a test | Every field change edits two files | Generate the JSON file from `schema.js` during `npm run build` | EV-007 | Low |
| DEBT-005 | Tooling | README pins Node 25.8.2, now end-of-life | No security fixes for the dev toolchain | See R-01 | EV-028 | Medium |
| DEBT-006 | Vendor bundles | `assets/vendor/` is committed; rebuilding on Windows shows many files changed by line endings only | Noisy diffs, risk of committing unrelated churn | `.gitattributes` for `assets/vendor/**`, or build in CI instead of committing | EV-018 | Low |

Refactoring proposals stay here; they are not current behavior.
