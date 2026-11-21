---
id: "OVERVIEW-GLOSSARY"
title: "Glossary"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-005", "EV-007", "EV-012", "EV-023", "EV-024", "EV-037"]
---

# Glossary

| Term | Meaning in this project | Reference |
|---|---|---|
| Card / note | One node of the graph: title, summary, type, tags, position, size, optional document. "Note" is the UI word, `card` the JSON key | [Data Model](../04-data-integrations/data-model.md) |
| Relation | A directed arrow between two cards, with label, colour, line and arrow style | EV-007 |
| Note Board | The free-layout view of the graph (formerly "Card Map") | `README.md` |
| Mind Map | The tree view from a root card; has its own positions and sizes | EV-007 |
| Branch / reference | In the Mind Map, a branch link builds the tree (collapsible); a reference link is any other link | EV-037 |
| Note paper | The default yellow, square card style on the Note Board | `README.md` |
| Group (frame) | A named frame around cards; groups nest up to 3 levels and can receive arrows from cards | EV-024 |
| Detail | The dialog that shows a card: reading tab, editor tab, format tab | [Components](../01-architecture/components/browser-app.md) |
| Draft | Unapplied edits inside Detail or an inline editor; guarded before closing or switching | EV-005 |
| Apply | Commits a draft as one store command (one Undo step) | EV-005 |
| Pin | Marks a card read-only; the store refuses any change to it | EV-023 |
| Document (`html-bs5`) | A note's rich content: sanitized HTML stored as a component tree | EV-012 |
| Extension (`card-atlas:*`) | Namespaced JSON object for data outside the core contract | EV-007 |
| Session state | Selection, open dialogs, drafts, copy buffer, locale: never written to the file | [Cross-cutting Concepts](../01-architecture/crosscutting-concepts.md) |
| Container (C4) | Separately runnable application or data store; not necessarily a Docker container | https://c4model.com/ |
| Component (C4) | Logical part inside one container | https://c4model.com/ |
| As-Is | Behavior and structure that exist and were observed or verified | — |
| To-Be | A proposal; never described as running | — |
