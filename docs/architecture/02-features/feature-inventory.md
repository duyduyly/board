---
id: "FEATURES-INVENTORY"
title: "Feature Inventory"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Whole system"
evidence_refs: ["EV-005", "EV-008", "EV-009", "EV-010", "EV-011", "EV-012", "EV-015", "EV-016", "EV-017", "EV-022", "EV-024", "EV-025", "EV-026", "EV-031", "EV-032", "EV-034", "EV-035", "EV-037", "EV-042", "EV-043", "EV-044", "EV-045"]
---

# Feature Inventory

Status: `ACTIVE` = reachable from the UI at this revision; `OPT-IN` = off until the user turns it on; `CLI` = developer script, not in the app.

| ID | Feature | Entry point (UI / code) | Status | Evidence |
|---|---|---|---|---|
| FEAT-001 | Start screen with template gallery (10 templates) and examples | Home; `ui/template-gallery.js`, `app.js` `loadExample` | ACTIVE | EV-011 |
| FEAT-002 | New, import (with preview) and export project JSON | Toolbar *Dự án mới*, *Nhập JSON*, *Xuất dự án*; `app.js` `importFile`, `exportProject` | ACTIVE | EV-009, EV-010 |
| FEAT-003 | Cards: add from palette (note paper, text, image, 12 shapes), drag, resize, pin, delete | Left palette, canvas; `canvas/`, `ui/shape-palette.js` | ACTIVE | EV-005 |
| FEAT-004 | Relations: draw by connector, label, colour, line and arrow style, curved / straight / orthogonal / zigzag, manual corners, automatic routing | Connector; `canvas/edge-editor.js`, `graph/edge-routing.js`, `graph/auto-routing.js` | ACTIVE | EV-005 |
| FEAT-005 | Note Board and Mind Map views; Mind Map conversion from a root, radial layout preview, collapse branches; hand-drawn links become branches when they extend the tree | View switch; `graph/convert-mind.js`, `graph/radial-layout.js`, `graph/mind-map.js` | ACTIVE | EV-037 |
| FEAT-006 | Multi-selection (Shift + click, marquee), group move, copy / paste / duplicate | Canvas, selection toolbar; `canvas/multi-selection.js`, `graph/copy-cards.js` | ACTIVE | EV-025 |
| FEAT-007 | Groups: named frames with description, nested up to 3 levels, arrows from cards to a group | Selection toolbar *Tạo nhóm*, frame buttons; `graph/card-groups.js`, `ui/group-editor.js` | ACTIVE | EV-024 |
| FEAT-008 | Detail reading view: outline, text size, theme, sanitized HTML, code highlighting | Card ↗ / double-click; `detail/html-content.js`, `detail/reading-contents.js` | ACTIVE | EV-012 |
| FEAT-009 | Mermaid diagrams and click-to-play YouTube videos in documents | Reading view; `detail/mermaid-render.js`, `detail/video-embed.js` | ACTIVE | EV-015, EV-016 |
| FEAT-010 | Block editor (GrapesJS) and HTML code mode (CodeMirror), element library, HTML import with base64 images, AI prompt copy and samples | Detail editor tab; `detail/block-editor.js`, `detail/element-library.js`, `detail/html-import.js` | ACTIVE | EV-034, EV-032, EV-035 |
| FEAT-011 | Format inspector: card, text, tags, arrow and page-wide styles | ? → Format; `ui/format-inspector.js` | ACTIVE | EV-005 |
| FEAT-012 | Search by title, summary, type, tags and content | Toolbar search, Ctrl+F; `ui/card-list.js` | ACTIVE | — (INFERRED, read only) |
| FEAT-013 | Selection JSON: copy or download the selected cards as a project | Selection toolbar *JSON*; `json/selection-export.js` | ACTIVE | EV-031 |
| FEAT-014 | Undo / Redo, draft guards, unload prompt | Toolbar, Ctrl+Z; `store/project-store.js` | ACTIVE | EV-005 |
| FEAT-015 | Crash recovery snapshot in the browser | Project menu *Khôi phục*; `store/recovery.js` | OPT-IN | EV-008 |
| FEAT-016 | Vietnamese / English UI, light / dark theme | `#locale`, theme button; `i18n/` | ACTIVE | EV-022 |
| FEAT-017 | ChatGPT shortcut window, quick help, decorative pixel pet | Right edge button, ? menu; `ui/chatgpt-launcher.js`, `ui/quick-help.js`, `ui/pixel-cat.js` | ACTIVE | EV-017 |
| FEAT-018 | Convert legacy Markdown projects | `node scripts/convert-markdown-files.mjs` | CLI | EV-026 |
| FEAT-019 | Export the project as a Word (.docx) document: groups as chapters, cards in view order, tables, lists, embedded images, links between notes; web images stay links; cannot be imported back. Code not committed at 22407c0 | Toolbar *Xuất Word*; `app.js` `exportWord`, `word-export/` | ACTIVE | EV-042, EV-043, EV-044, EV-045 |

## How this inventory was built

From the UI action map in `assets/js/app.js` (`const actions` at line 2403: `import`, `export`, `new`, `add`, `connect`, `group-create`, `selection-duplicate`, `selection-copy-json`, `convert-mind`, `layout`, `auto-route-all`, `recovery`, `format`, `help`, `theme` …), the module list in `assets/js/`, the README and the quick help text. No feature flags exist; nothing found is disabled. Mobile layouts show a "use a desktop" notice (README), so mobile editing is not counted as a feature.
