---
id: "OPS-ENVIRONMENTS"
title: "Environments and Configuration"
doc_type: reference
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "All environments"
evidence_refs: ["EV-003", "EV-020", "EV-027"]
---

# Environments and Configuration

| Environment | Purpose | URL / host | How it is started | Config source | Evidence | Status |
|---|---|---|---|---|---|---|
| Local development | Run and debug the app | http://127.0.0.1:4173 | `npm run dev` | `scripts/serve.mjs` (fixed host and port) | EV-003 | VERIFIED |
| E2E test | Playwright against the local dev server | http://127.0.0.1:4173 | `npm run dev` + `npm run e2e` | `playwright.config.js` | EV-020 | VERIFIED |
| Staging / production | UNKNOWN | UNKNOWN | UNKNOWN | No CI, container or hosting files in the repository | EV-027 | UNKNOWN |

The app has no runtime configuration, no environment variables and no feature flags. User preferences (locale, theme, ChatGPT shortcut visibility) are session-only; only the recovery opt-in flag persists in `localStorage`.
