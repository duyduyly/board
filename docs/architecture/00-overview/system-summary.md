---
id: "OVERVIEW-SYSTEM-SUMMARY"
title: "System Summary"
doc_type: explanation
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-002", "EV-003", "EV-004", "EV-005", "EV-006", "EV-007", "EV-008", "EV-010", "EV-018", "EV-022", "EV-026", "EV-027", "EV-030"]
---

# System Summary

## Purpose and value

Card Atlas is a **visual note and knowledge-map editor that runs entirely in the browser**. A user places notes (cards) on a canvas, connects them with arrows, groups them in named frames, and writes a rich document inside each note. The same graph is shown in two views: **Note Board** (free layout) and **Mind Map** (a tree from a root note). The whole project is a single JSON file the user imports and exports; there is no account, server or database (EV-002, EV-004, EV-010).

Typical uses named in the README: study notes, knowledge maps, workflows and architecture notes, with Vietnamese and English UI and light/dark themes (EV-022 in [Technology Stack](technology-stack.md)).

## Scope

| Included | Excluded | Evidence |
|---|---|---|
| Browser app in `index.html` and `assets/js/` (vanilla ES modules) | Any backend, API, database or user account | EV-002, EV-003 |
| Project JSON contract 1.0 and its validator | Real-time collaboration, sync between devices | EV-006, EV-007 |
| Local dev server `scripts/serve.mjs` (static files only) | Production hosting (none in the repository) | EV-003, EV-027 |
| Build of third-party libraries into `assets/vendor/` | Loading code from a CDN at runtime | EV-018, EV-030 |
| Opt-in crash recovery in browser storage | Implicit saving: data is lost unless exported or recovery is turned on | EV-008, EV-030 |
| Offline CLI to convert legacy Markdown projects | — | EV-026 |

## Operating scale (only with evidence)

Hard limits enforced on every change and import: one file ≤ 10 MiB, ≤ 500 cards, ≤ 2,000 relations, ≤ 100,000 content characters per card; undo history ≤ 100 steps / 20 MiB (EV-005, EV-006). Real usage numbers are `UNKNOWN`.

## Big picture

One person opens the page from a static server, works on a project in browser memory, and saves it by exporting a JSON file. Optional outside contacts happen only from the user's browser: remote images in documents, a YouTube player after pressing play, and a shortcut that opens ChatGPT in another window. See [System Context](../01-architecture/system-context.md) and [Container View](../01-architecture/container-view.md).

## Document map

| Question | Read |
|---|---|
| What is it built with? | [Technology Stack](technology-stack.md) |
| What parts does it have? | [Container View](../01-architecture/container-view.md), [Components](../01-architecture/components/browser-app.md) |
| What can a user do? | [Feature Inventory](../02-features/feature-inventory.md) |
| What happens on a click? | [User Action Lifecycle](../03-workflows/request-lifecycle.md) |
| What is in the file? | [Data Model](../04-data-integrations/data-model.md) |
| What can go wrong? | [Known Risks](../07-decisions-changes/known-risks.md) |

## Open questions

| Question | Owner | Status |
|---|---|---|
| Who owns the product and reviews these docs? | UNKNOWN | UNKNOWN |
| Is the app hosted anywhere besides `npm run dev`? | UNKNOWN | UNKNOWN |
| What are the top quality goals? | UNKNOWN | UNKNOWN |
