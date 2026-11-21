---
id: "FEATURES-BUSINESS-RULES"
title: "Business Rules"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-005", "EV-006", "EV-007", "EV-012", "EV-016", "EV-021", "EV-023", "EV-024", "EV-025", "EV-032", "EV-037"]
---

# Business Rules

| ID | Rule | Enforced in | Evidence | Status |
|---|---|---|---|---|
| BR-001 | A project file is at most 10 MiB, 500 cards, 2,000 relations and 100,000 content characters per card | `json/validator.js` `LIMITS`, `stage` | EV-006 | VERIFIED |
| BR-002 | Unknown JSON fields are rejected; extra data is allowed only under namespaced `card-atlas:*` extensions | `json/schema.js` | EV-007 | VERIFIED |
| BR-003 | Every relation joins two existing cards; ids are unique; no self-loops | `json/validator.js` | EV-006 | VERIFIED |
| BR-004 | A pinned card cannot be changed by any command until it is unpinned | `graph/card-lock.js`, `ProjectStore.commit` | EV-023 | VERIFIED |
| BR-005 | One user action is one Undo step; history keeps the last 100 steps and at most 20 MiB | `store/project-store.js` | EV-005 | VERIFIED |
| BR-006 | A card belongs to at most one group (the innermost); groups nest up to 3 levels; a group must hold notes or subgroups | `graph/card-groups.js` | EV-024 | VERIFIED |
| BR-007 | An arrow to a group must start outside that group; one arrow per card and group | `graph/card-groups.js` `groupLinkIssue` | EV-024 | VERIFIED |
| BR-008 | In the Mind Map a drawn link is a branch only when the target has no parent, is not the root and is not an ancestor of the source | `graph/mind-map.js` `newLinkKind` | EV-037 | VERIFIED |
| BR-009 | Copies are unpinned, get new ids and creation dates, and keep only links between copied cards | `graph/copy-cards.js` | EV-025 | VERIFIED |
| BR-010 | Document HTML is limited to an allowlist of tags, attributes and simple styles; 3,000 nodes, depth 32 | `graph/html-document.js`, `detail/html-content.js` | EV-012 | VERIFIED |
| BR-011 | Images are PNG, JPEG, WebP or GIF (checked by magic bytes), at most 10 MiB each | `detail/attachments.js` | EV-032 | VERIFIED |
| BR-012 | A YouTube video is embedded only for a valid 11-character id on youtube.com or youtu.be | `graph/youtube.js` | EV-016 | VERIFIED |
| BR-013 | Closing or switching away from unapplied drafts asks first; closing the tab asks while changes are not exported | `app.js` `guardDraft`, `beforeunload` | EV-021 | VERIFIED |
