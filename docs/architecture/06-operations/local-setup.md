---
id: "OPS-LOCAL-SETUP"
title: "Local Setup"
doc_type: how-to
status: DRAFT
owner: "UNKNOWN"
reviewed_at: null
system_version: "1.0.0"
source_revision: "22407c017fffc2a2b6c774878dfd77ec991f91d6"
scope: "Developer machine"
evidence_refs: ["EV-001", "EV-003", "EV-018", "EV-020", "EV-028", "EV-029", "EV-035"]
---

# Local Setup

## Prerequisites

- Node.js with npm. The README states it was checked with **Node 25.8.2** (EV-028), which is end-of-life since 2026-06-01 (EV-029); a supported line (26 Active LTS or 24 Maintenance LTS) is untested here.
- A desktop browser: Chrome, Edge or Firefox. Playwright uses the installed Chrome and Edge channels (EV-020).
- No database, accounts, secrets or environment variables are needed.

## Setup commands

From the repository root (commands from `README.md` and `package.json`, EV-001):

```sh
npm ci            # install exact dependencies from package-lock.json
npm run build     # bundle third-party libraries into assets/vendor/ and copy the AI prompt into assets/data/
npm run dev       # serve the app on http://127.0.0.1:4173
```

Open http://127.0.0.1:4173. Do not open `index.html` from disk (`file://`): ES modules, templates and vendor chunks need HTTP (EV-003). `npm run build` only needs to run again after dependencies or `docs/board-html-prompt.md` change (EV-018, EV-035).

## Configuration

None. Port 4173 and host 127.0.0.1 are fixed in `scripts/serve.mjs` and in `playwright.config.js` (EV-003, EV-020).

## Verification

```sh
npm test               # unit tests
npm run check          # syntax, lint, architecture gate
npm run typecheck
npm run format:check
npm run e2e            # needs npm run dev in another terminal
```

The home screen shows the template gallery; choosing a template opens the Note Board. See [Test Strategy](../05-security-quality/test-strategy.md) for known E2E failures.
