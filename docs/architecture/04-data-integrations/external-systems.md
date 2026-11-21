---
id: "DATA-EXTERNAL-SYSTEMS"
title: "External Systems"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Systems outside Card Atlas"
evidence_refs: ["EV-014", "EV-016", "EV-017", "EV-018", "EV-030"]
---

# External Systems

No server-side integrations exist. Every contact below starts in the user's browser.

| ID | System | Used for | Direction / protocol | Trigger | Failure behavior | Evidence | Status |
|---|---|---|---|---|---|---|---|
| EXT-001 | Remote image hosts (any `http`/`https` URL in a document) | Showing images referenced by URL | Browser → host · HTTPS/HTTP | Opening a document (automatic) | Broken image; document still readable | EV-014 | VERIFIED |
| EXT-002 | YouTube (`www.youtube-nocookie.com/embed/<id>`) | Playing videos linked with class `board-video` | Browser → YouTube · HTTPS, sandboxed iframe | User presses play | YouTube error inside the player; link to open on YouTube | EV-016 | VERIFIED |
| EXT-003 | ChatGPT (`chatgpt.com`) | Shortcut window for writing help | Browser navigation, `noopener,noreferrer` | User clicks the shortcut | Popup blocked → menu offers a new-tab link | EV-017 | VERIFIED |

No webhooks, no API keys, no CDN: third-party libraries are bundled locally (EV-018, EV-030).
