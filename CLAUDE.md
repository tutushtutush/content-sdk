# content-sdk

The headless browser SDK for content-api: fetches content from the service's public delivery endpoint and hands **plain data** to a platform, which renders it with its own components. No UI,
no DOM, no runtime dependencies. It reports views and link clicks to content-api's events endpoint (feature 004); ranking is content-api's and comes later.

Read first: `.specify/memory/constitution.md`, then the current feature in `specs/`. Every change goes through the spec-kit lifecycle (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-analyze` → `/speckit-implement` → `/speckit-converge`).

**Status**: created 2026-11-16; remote `github.com/tutushtutush/content-sdk` (private). Feature 001, the delivery client (fetch items, page by cursor, typed errors), is merged. Feature 002, the browser bundle and script-tag loader, is merged. Feature 003, the search option (`q` in the query of `fetchPage`, version 0.3.0), is merged and tagged `v0.3.0`, and content-api serves it since its spec 013. Feature 004, reporting views and link clicks (`watchView` and `trackLinkClick`, version 0.4.0, for content-api's events endpoint, spec 014 there), is built on the branch `004-view-events`; content-api serves it only after a tag and its own pin change, and nothing is tagged or pushed until the owner says so.

## Working agreement

- One small feature per pull request; the owner decides every design choice and dependency; options and a recommendation first.
- Do not push, merge, publish or create remote resources without the owner's explicit go-ahead; merge only when the owner says "merge".
- Never put secrets in files. Record decisions and reversals in the spec's `research.md`.

## Where things are

| Need | Where |
|---|---|
| The service's contract (read only) | `/Users/tsega/Documents/Git/content-api/specs/009-public-delivery-endpoint/contracts/delivery-v1.md`, `specs/010-item-link-out/contracts/item-url.md`, `docs/origin/034-content-service-split/contracts/openapi-content-api.yaml` |
| Build and layout precedent (read only) | `/Users/tsega/Documents/Git/ad-serve-client` |
| Hosted test service | `https://content-api-test.onrender.com`; platform `listings`, placement `latest`; allowed origin `https://listings-test-nine.vercel.app` |
