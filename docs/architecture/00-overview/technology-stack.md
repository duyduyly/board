---
id: "OVERVIEW-TECHNOLOGY-STACK"
title: "Technology Stack"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-001", "EV-002", "EV-003", "EV-006", "EV-008", "EV-012", "EV-015", "EV-018", "EV-019", "EV-020", "EV-022", "EV-026", "EV-027", "EV-028", "EV-029", "EV-030", "EV-033", "EV-034", "EV-039"]
---

# Technology Stack

| Layer | Technology / version | Source (lockfile, config) | Support (supported / security-only / EOL) | End of support | Status |
|---|---|---|---|---|---|
| Runtime (app) | Desktop browser: Chrome, Edge, Firefox; vanilla ES modules, no framework | `playwright.config.js` projects; `index.html` | Evergreen browsers | — | VERIFIED (EV-020, EV-002) |
| Runtime (tooling) | Node.js 25.8.2 on the developer machine | `README.md`, `node --version` | **End-of-life** | 2026-06-01 | VERIFIED (EV-028, EV-029) |
| Framework / CMS | None | `package.json` | NOT_APPLICABLE | — | VERIFIED (EV-001) |
| Web server | `scripts/serve.mjs`, Node `http`, 127.0.0.1:4173, dev only | `scripts/serve.mjs` | — | — | VERIFIED (EV-003) |
| Database | None; the project is a JSON file | `assets/js/json/` | NOT_APPLICABLE | — | VERIFIED (EV-006) |
| Cache / queue | None | searched `assets/js`, `scripts` | NOT_APPLICABLE | — | VERIFIED |
| Storage | User files (import/export); optional IndexedDB + `localStorage` flag for recovery | `assets/js/store/recovery.js` | Browser built-in | — | VERIFIED (EV-008) |
| Infrastructure / CI | None in the repository | `git ls-files` | NOT_APPLICABLE | — | VERIFIED (EV-027) |

Node.js 25 is an odd-numbered release that is already end-of-life (EV-029). The current Active LTS line is Node.js 26 (to 2029-04-30); Node.js 24 is Maintenance LTS (to 2028-04-30). Which line to adopt is an open question for the owner (see [Known Risks](../07-decisions-changes/known-risks.md) R-01).

## Key dependencies

All runtime libraries are bundled by esbuild into `assets/vendor/` and loaded from the same origin (EV-018). Versions are exact pins in `package.json` (EV-001).

| Package / extension | Version | Purpose | Loaded / active? | Maintained? (last release, EOL) | Evidence |
|---|---|---|---|---|---|
| cytoscape | 3.34.3 | Graph canvas, edges, hit-testing | Active, every page load | UNKNOWN | EV-033 |
| grapesjs | 0.23.9 | Visual block editor for note documents | Active when a note is edited | UNKNOWN | EV-034 |
| codemirror + @codemirror/* | 6.0.2 / 6.x | HTML code mode, find, lint | Active in code mode | UNKNOWN | EV-034 |
| dompurify | 3.4.17 | Sanitizes HTML and Mermaid SVG | Active | UNKNOWN | EV-012, EV-015 |
| ajv | 8.20.0 | JSON schema validation of every project change | Active | UNKNOWN | EV-006 |
| bootstrap (CSS only) | 5.3.8 | Styling inside note documents | Active in documents | UNKNOWN | EV-018 |
| highlight.js | 11.12.0 | Code highlighting in documents | Lazy, when a document has code | UNKNOWN | EV-018 |
| mermaid | 12.3.0 | Diagrams in the reading view (ELK layout left out) | Lazy, when a document has a diagram | UNKNOWN | EV-015, EV-018 |
| marked | 18.1.0 | Legacy Markdown conversion | Used by the conversion script | UNKNOWN | EV-026 |
| esbuild | 0.28.2 | Builds vendor bundles | Dev | UNKNOWN | EV-018 |
| @playwright/test | 1.64.0 | E2E tests in Chrome, Edge, Firefox | Dev | UNKNOWN | EV-020 |
| eslint / prettier / typescript | 10.12.0 / 3.9.10 / 7.0.2 | Lint, format, type check | Dev | UNKNOWN | EV-019, EV-039 |

Maintenance status and end-of-life of each library were not looked up; they stay `UNKNOWN`.

## Dependency policy

From project policy (EV-030): no runtime CDN, no analytics, no new dependency unless the owner asks; every library is built into `assets/vendor/` with its licence file next to it. UI text goes through `t(key)` with Vietnamese and English dictionaries (EV-022).
