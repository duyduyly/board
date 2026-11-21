---
id: "DOCS-INDEX"
title: "Card Atlas — Architecture Documentation"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: []
---

# Card Atlas — Architecture Documentation

As-is documentation of Card Atlas 1.0.0, checked against revision `22407c017fffc2a2b6c774878dfd77ec991f91d6` (`main`, 2026-11-21). It answers: what the system is responsible for, what it contains, how parts communicate, how the main workflows run, where data is stored and sent, how untrusted content is controlled, how it is built and run, what can fail and how to investigate, and which facts are verified or still uncertain.

Older, Vietnamese design notes per epic live in [`docs/development.md`](../development.md); these pages summarize the current state in English and point to code evidence.

## Start here

1. [System Summary](00-overview/system-summary.md)
2. [System Context (C4 L1)](01-architecture/system-context.md) → [Container View (C4 L2)](01-architecture/container-view.md) → [Components (C4 L3)](01-architecture/components/browser-app.md)
3. [User Action Lifecycle](03-workflows/request-lifecycle.md) and the workflows: [Import](03-workflows/forms/import-project.md), [Export](03-workflows/forms/export-project.md), [Export to Word](03-workflows/forms/export-word.md), [Apply a note document](03-workflows/forms/apply-note-document.md), [Read a document with diagrams and video](03-workflows/events/read-document-media.md), [Recovery snapshot](03-workflows/events/recovery-snapshot.md)
4. [Data Model](04-data-integrations/data-model.md) → [Data Flows](04-data-integrations/data-flows.md)
5. Runbooks: [Import rejected](06-operations/runbooks/import-rejected.md), [App or editor does not load](06-operations/runbooks/app-does-not-load.md), [E2E timeouts](06-operations/runbooks/e2e-timeouts.md)
6. [Known Risks](07-decisions-changes/known-risks.md) and [Evidence Register](evidence/evidence-register.md)

## Structure

| Folder | Contents |
|---|---|
| `00-overview/` | [Summary](00-overview/system-summary.md), [scope and goals](00-overview/scope-and-goals.md), [technology stack](00-overview/technology-stack.md), [glossary](00-overview/glossary.md) |
| `01-architecture/` | C4 context, containers, [components](01-architecture/components/component-index.md), [deployment view](01-architecture/deployment-view.md), [cross-cutting concepts](01-architecture/crosscutting-concepts.md), [solution strategy](01-architecture/solution-strategy.md) |
| `02-features/` | [Feature inventory](02-features/feature-inventory.md), [business rules](02-features/business-rules.md) |
| `03-workflows/` | User action lifecycle, import / export / apply / read / recovery flows |
| `04-data-integrations/` | Data model, data flows, [external systems](04-data-integrations/external-systems.md) |
| `05-security-quality/` | [Trust boundaries and threats](05-security-quality/security-architecture.md), [quality requirements](05-security-quality/quality-requirements.md), [test strategy](05-security-quality/test-strategy.md) |
| `06-operations/` | [Local setup](06-operations/local-setup.md), [environments](06-operations/environments.md), [build and release](06-operations/deployment.md), [rollback](06-operations/rollback.md), [backup and restore](06-operations/backup-restore.md), runbooks |
| `07-decisions-changes/` | ADRs [0001](07-decisions-changes/adr/0001-static-backendless-json-file.md) · [0002](07-decisions-changes/adr/0002-namespaced-extensions-contract.md) · [0003](07-decisions-changes/adr/0003-sanitized-html-sandboxed-frame.md) · [0004](07-decisions-changes/adr/0004-vendored-libraries-no-cdn.md), known risks, [technical debt](07-decisions-changes/technical-debt.md), [Markdown migration](07-decisions-changes/migrations/markdown-to-html-document.md) |
| `evidence/` | [Evidence register](evidence/evidence-register.md), [verification report](evidence/verification-report.md) |
| root | [CHECKLIST](CHECKLIST.md) (coverage), [QUALITY-GATES](QUALITY-GATES.md) |

Not written because they do not apply (reasons in the [checklist](CHECKLIST.md)): stakeholders, authentication, data dictionary, API contracts, authorization matrix, monitoring.

## Conventions

- Claim statuses: `VERIFIED` (traceable to source/test at a revision), `INFERRED` (reasoned, not confirmed), `UNKNOWN` (not determined), `NOT_APPLICABLE` (checked, not relevant), `EXAMPLE` (illustrative). `VERIFIED` is not "tested in production".
- Diagrams: solid arrow = synchronous / next step; dashed = asynchronous; blue = the element in focus or entry point; gray = external; `(manual)`, `(proposed)`, `(UNKNOWN)` in a label = not implemented as automation.

## Standards used

[C4 model](https://c4model.com/) · [arc42](https://arc42.org/) · [Diátaxis](https://diataxis.fr/) · [MADR 4](https://adr.github.io/madr/) · [ISO/IEC 25010 quality model](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010) · [OWASP Threat Modeling (STRIDE)](https://owasp.org/www-community/Threat_Modeling)
