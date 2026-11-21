---
id: "ARCH-SYSTEM-CONTEXT"
title: "C4 L1 — System Context"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Card Atlas and its environment"
evidence_refs: ["EV-002", "EV-010", "EV-014", "EV-016", "EV-017", "EV-030"]
---

# C4 L1 — System Context

**Purpose:** Who uses Card Atlas, and which outside systems does it touch?

**Scope:** C4 L1 System Context · Card Atlas · audience: everyone.

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "step"}}}%%
flowchart LR
  accTitle: System context of Card Atlas
  accDescr: One person edits note graphs in Card Atlas and keeps projects as JSON files on the computer; the app may load remote images, play YouTube videos on request and open ChatGPT in another window.
  USR["Note author (person)"] -->|"edits notes and maps"| SYS["Card Atlas"]
  SYS -->|"imports, exports JSON"| FS["Local file system"]
  SYS -->|"loads document images"| IMG["Remote image hosts"]
  SYS -->|"plays video on click"| YT["YouTube"]
  SYS -->|"opens new window"| GPT["ChatGPT"]
  class SYS accent
  class FS external
  class IMG external
  class YT external
  class GPT external

  classDef default fill:#FFFFFF,stroke:#64748B,color:#111827
  classDef accent fill:#DBEAFE,stroke:#1E40AF,color:#111827
  classDef external fill:#F1F5F9,stroke:#64748B,color:#111827
```

**Explanation:** The blue box is the system; gray boxes are outside it. There is one kind of user and no other system calls Card Atlas. The local file system is outside the system: the app only sees the files the user picks and saves (EV-010). Remote images load automatically when a document references them (EV-014); YouTube loads only after the user presses play (EV-016); the ChatGPT shortcut opens a separate window and sends nothing (EV-017).

**Evidence:** EV-002, EV-010, EV-014, EV-016, EV-017 — status `VERIFIED`.

**Limitations / Unknowns:** Links inside documents open any `http(s)` site in a new tab; that is the user's navigation, not an integration, and is not drawn. Whether the app is hosted for other users is `UNKNOWN`.

**Related:** [Container View](container-view.md), [External Systems](../04-data-integrations/external-systems.md).

## Actors and interactions

| Actor / system | Interaction | Direction | Evidence | Status |
|---|---|---|---|---|
| Note author (person) | Creates and edits cards, links, groups and documents; imports and exports projects | Inbound | EV-002 | VERIFIED |
| Local file system | `<input type="file">` to read a project; Blob download to save one | Both, user-initiated | EV-010 | VERIFIED |
| Remote image hosts | Browser fetches `http(s)` images referenced in a document | Outbound | EV-014 | VERIFIED |
| YouTube (`youtube-nocookie.com`) | Embedded player after a click on a video placeholder | Outbound | EV-016 | VERIFIED |
| ChatGPT (`chatgpt.com`) | Opened in a new window; no data passed | Outbound navigation | EV-017 | VERIFIED |

## Boundary

Inside: everything served from `index.html` and `assets/`. Outside: the user's files, every third-party site, and the browser itself. By policy nothing is uploaded and no analytics are sent (EV-030).
