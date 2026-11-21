---
id: "DOCS-CHECKLIST"
title: "Documentation Checklist"
doc_type: how-to
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-005", "EV-006", "EV-008", "EV-010", "EV-012", "EV-013", "EV-014", "EV-015", "EV-016", "EV-017", "EV-027", "EV-030", "EV-036"]
---

# Documentation checklist

Revision: 22407c017fffc2a2b6c774878dfd77ec991f91d6 · Scanned: 2026-11-21 · Mode: checklist-auto
Coverage: 100% (44 of 44 items) · Verified-only: 93%

Legend: `[ ]` to do · `[x]` done · `[~]` not applicable / skipped (reason required, left out of the percent)
Priority: **core** = needed to understand the system · **normal** · **extra** = nice to have

## 00-overview
- [x] CL-001 · **System summary**: what Card Atlas is, what it is not, and where to read next · core
  - file: `00-overview/system-summary.md`
  - found: `README.md`, `index.html`, `assets/js/app.js`
- [x] CL-002 · **Technology stack** with versions and Node.js support status · core
  - file: `00-overview/technology-stack.md`
  - found: `package.json`, `package-lock.json`, `scripts/build.mjs`
- [x] CL-003 · **Scope, goals and constraints**: offline, file-based, no server · normal
  - file: `00-overview/scope-and-goals.md`
  - found: `AGENTS.md` line 94, `CLAUDE.md`
- [~] CL-004 · Stakeholders
  - file: `00-overview/stakeholders.md`
  - N/A: the repository names one git author and no roles; owners and approvers are asked in the system summary open questions
- [x] CL-005 · **Glossary**: Note Board, Mind Map, Note paper, Detail, draft, Apply, pin, extension · normal
  - file: `00-overview/glossary.md`
  - found: `assets/js/i18n/vi.js`, `README.md`

## 01-architecture
- [x] CL-010 · **System context**: the user, the browser and the few outside services · core
  - file: `01-architecture/system-context.md`
  - found: `assets/js/ui/chatgpt-launcher.js`, `assets/js/graph/youtube.js`
- [x] CL-011 · **Container view**: the browser app, the static files, the user's JSON files and browser storage · core
  - file: `01-architecture/container-view.md`
  - found: `scripts/serve.mjs`, `assets/js/store/recovery.js`
- [x] CL-012 · **Component index** · normal
  - file: `01-architecture/components/component-index.md`
  - found: `assets/js/*/`
- [x] CL-013 · **Components of the browser app**: orchestrator, store, JSON, graph, canvas, detail, ui · normal
  - file: `01-architecture/components/browser-app.md`
  - found: `assets/js/app.js`, `scripts/architecture.mjs`
- [x] CL-014 · **Deployment view**: where it runs today · normal
  - file: `01-architecture/deployment-view.md`
  - found: `scripts/serve.mjs`; no hosting config (EV-027)
- [x] CL-015 · **Cross-cutting concepts**: commands and undo, validation, sanitizing, i18n, theming, session state · normal
  - file: `01-architecture/crosscutting-concepts.md`
  - found: `assets/js/store/project-store.js`, `assets/js/i18n/`
- [x] CL-016 · **Solution strategy**: the few decisions that shape everything · normal
  - file: `01-architecture/solution-strategy.md`
  - found: `CLAUDE.md`, `docs/development.md`

## 02-features
- [x] CL-020 · **Feature inventory** with active / disabled status · core
  - file: `02-features/feature-inventory.md`
  - found: `index.html` actions, `assets/js/app.js` `actions` map
- [x] CL-021 · **Business rules**: limits, pins, groups, links, drafts · normal
  - file: `02-features/business-rules.md`
  - found: `assets/js/json/validator.js`, `assets/js/graph/card-groups.js`

## 03-workflows
- [x] CL-030 · **User action lifecycle**: from a click to a new project state and a redraw · core
  - file: `03-workflows/request-lifecycle.md`
  - found: `assets/js/app.js` `change`, `store.commit`, `render`
- [~] CL-031 · Authentication
  - file: `03-workflows/authentication.md`
  - N/A: no login, sessions, tokens or roles; searched `assets/js`, `scripts`, `index.html` (see security architecture)
- [x] CL-032 · **Import a project file** · normal
  - file: `03-workflows/forms/import-project.md`
  - found: `assets/js/app.js` `importFile`
- [x] CL-033 · **Export a project file** · normal
  - file: `03-workflows/forms/export-project.md`
  - found: `assets/js/app.js` `exportProject`
- [x] CL-034 · **Edit and apply a note document** · normal
  - file: `03-workflows/forms/apply-note-document.md`
  - found: `assets/js/detail/block-editor.js`, `assets/js/app.js` `applyDraft`
- [x] CL-035 · **Read a document with diagrams and video** · normal
  - file: `03-workflows/events/read-document-media.md`
  - found: `assets/js/detail/html-content.js`, `mermaid-render.js`, `video-embed.js`
- [x] CL-036 · **Opt-in recovery snapshot** · extra
  - file: `03-workflows/events/recovery-snapshot.md`
  - found: `assets/js/store/recovery.js`

## 04-data-integrations
- [x] CL-040 · **Data model**: the project JSON contract · core
  - file: `04-data-integrations/data-model.md`
  - found: `assets/js/json/schema.js`, `assets/data/project.schema.json`
- [~] CL-041 · Data dictionary
  - file: `04-data-integrations/data-dictionary.md`
  - N/A: field definitions live in `assets/data/project.schema.json` and the Format Guide; the data model links to them instead of copying
- [x] CL-042 · **Data flows**: where project data goes · normal
  - file: `04-data-integrations/data-flows.md`
  - found: import, export, recovery, media fetches
- [x] CL-043 · **External systems**: YouTube, remote image hosts, ChatGPT · normal
  - file: `04-data-integrations/external-systems.md`
  - found: EV-014, EV-016, EV-017
- [~] CL-044 · API contracts
  - file: `04-data-integrations/api-contracts.md`
  - N/A: no HTTP API; the only contract is the project file, documented in the data model

## 05-security-quality
- [x] CL-050 · **Security architecture**: trust boundaries and STRIDE threats · normal
  - file: `05-security-quality/security-architecture.md`
  - found: EV-012, EV-013, EV-015, EV-016
- [~] CL-051 · Authorization matrix
  - file: `05-security-quality/authorization-matrix.md`
  - N/A: single local user, no roles or permissions
- [x] CL-052 · **Quality requirements**: limits and scenarios; goals need the owner · normal
  - file: `05-security-quality/quality-requirements.md`
  - found: EV-005, EV-006
- [x] CL-053 · **Test strategy** and current test health · normal
  - file: `05-security-quality/test-strategy.md`
  - found: `playwright.config.js`, `package.json`

## 06-operations
- [x] CL-060 · **Local setup** · core
  - file: `06-operations/local-setup.md`
  - found: `README.md`, `package.json`
- [x] CL-061 · **Environments** · normal
  - file: `06-operations/environments.md`
  - found: `scripts/serve.mjs`
- [x] CL-062 · **Build and release** · normal
  - file: `06-operations/deployment.md`
  - found: `scripts/build.mjs`; no CI (EV-027)
- [x] CL-063 · **Rollback** · extra
  - file: `06-operations/rollback.md`
  - found: git history only
- [x] CL-064 · **Backup and restore** of user projects · normal
  - file: `06-operations/backup-restore.md`
  - found: EV-008, EV-010
- [~] CL-065 · Monitoring
  - file: `06-operations/monitoring.md`
  - N/A: no server and no telemetry by policy (EV-030); the only signals are in-app status lines and the browser console
- [x] CL-066 · **Runbook: a project file is rejected on import** · normal
  - file: `06-operations/runbooks/import-rejected.md`
  - found: `assets/js/json/validator.js` error codes
- [x] CL-067 · **Runbook: the app or editor does not load** · normal
  - file: `06-operations/runbooks/app-does-not-load.md`
  - found: `scripts/serve.mjs`, `assets/vendor/`
- [x] CL-068 · **Runbook: E2E suite times out** · extra
  - file: `06-operations/runbooks/e2e-timeouts.md`
  - found: EV-036

## 07-decisions-changes
- [x] CL-070 · **Known risks and open questions** · core
  - file: `07-decisions-changes/known-risks.md`
- [x] CL-071 · **Technical debt** · normal
  - file: `07-decisions-changes/technical-debt.md`
- [x] CL-072 · **ADR: a static, backend-less app with the project as a JSON file** · normal
  - file: `07-decisions-changes/adr/0001-static-backendless-json-file.md`
  - found: `CLAUDE.md`, `scripts/serve.mjs`
- [x] CL-073 · **ADR: strict contract with namespaced extensions** · normal
  - file: `07-decisions-changes/adr/0002-namespaced-extensions-contract.md`
  - found: `assets/js/json/schema.js`
- [x] CL-074 · **ADR: sanitized HTML in a sandboxed reading frame** · normal
  - file: `07-decisions-changes/adr/0003-sanitized-html-sandboxed-frame.md`
  - found: `assets/js/detail/html-content.js`
- [x] CL-075 · **ADR: vendored libraries, no CDN** · normal
  - file: `07-decisions-changes/adr/0004-vendored-libraries-no-cdn.md`
  - found: `scripts/build.mjs`
- [x] CL-076 · **Migration: legacy Markdown notes to HTML documents** · normal
  - file: `07-decisions-changes/migrations/markdown-to-html-document.md`
  - found: `scripts/convert-markdown-files.mjs`

## evidence
- [x] CL-080 · **Evidence register** · core
  - file: `evidence/evidence-register.md`
- [x] CL-081 · **Verification report** · core
  - file: `evidence/verification-report.md`

## root
- [x] CL-090 · **Documentation index** · core
  - file: `README.md`
- [x] CL-091 · **Quality gates and diagram audit** · core
  - file: `QUALITY-GATES.md`

## Gaps the scan could not decide

1. Who owns Card Atlas, who reviews these docs, and who decides on releases?
2. What are the top 3–5 quality goals (for example: no data loss, works offline, fast with 500 cards)?
3. Is the app published anywhere (static hosting, intranet), or only run locally with `npm run dev`?
4. Which Node.js line should development use now that 25 is end-of-life?
5. Are the 104 failing E2E tests known and accepted, or should they block releases?
