# content-sdk

The headless browser SDK for content-api: fetches content from the service's public delivery endpoint and hands **plain data** to a platform, which renders it with its own components. No UI,
no DOM, no runtime dependencies. It reports views and link clicks to content-api's events endpoint (feature 004); ranking is content-api's and comes later.

Read first: `.specify/memory/constitution.md`, then the current feature in `specs/`. Every change goes through the spec-kit lifecycle (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-analyze` → `/speckit-implement` → `/speckit-converge`).

**Status**: created 2026-11-16; remote `github.com/tutushtutush/content-sdk` (private). Feature 001, the delivery client (fetch items, page by cursor, typed errors), is merged. Feature 002, the browser bundle and script-tag loader, is merged. Feature 003, the search option (`q` in the query of `fetchPage`, version 0.3.0), is merged and tagged `v0.3.0`, and content-api serves it since its spec 013. Feature 004, reporting views and link clicks (`watchView` and `trackLinkClick`, version 0.4.0, for content-api's events endpoint, spec 014 there), is built on the branch `004-view-events`; content-api serves it only after a tag and its own pin change, and nothing is tagged or pushed until the owner says so. **Feature 005 (the session id)**: `watchView` and `trackLinkClick` take an optional `sessionId` (1 to 128 characters, no NUL; `null` is none) that is sent as `session_id`, for content-api's stored visit reference (its spec 017); the platform supplies it on each call and the SDK makes none, keeps nothing between calls and has no default (constitution I and VI); a bad value is left out with one warning; no `event_id` is sent (the SDK does not retry); version `0.5.0`, built on the branch `005-session-id`; the owner tags `v0.5.0` after the merge and content-api takes the tag in its own spec. **Feature 006 (the sort option)**: `fetchPage` takes an optional `sort` (`popular`, `newest` or `oldest`, exactly, in lower case; anything else, an empty text included, is a `bad_query` naming `sort` with no request) and sends it as `sort`, for content-api's delivery sort (its spec 020, merged 2026-11-18); no `sort` sends none and keeps the service's order, the SDK adds no default and keeps nothing between calls, the cursor passes through unchanged (the service judges whether it fits the order), the script-tag loader needs no code; the SDK does not return the service's `view_count` (research R10, an open decision for the owner); version `0.6.0`, built on the branch `006-fetchpage-sort`; the owner tags `v0.6.0` after the merge and content-api takes the tag in its own spec. **Feature 007 (the item view count)**: each item now carries `view_count`, the service's whole number of 0 or more (content-api spec 019), spelled as the service spells it and passed on unchanged; it is required (owner's option A): a missing or bad value (not a number, negative, a fraction, above the largest safe integer) refuses the whole page as `contract_mismatch`, never a default and never a partial page; the SDK formats, sums and adjusts nothing, and the request, the loader and the events are unchanged; the exported `Item` type requires the field, so code that builds items by hand needs it; this resolves feature 006's research R10; version `0.7.0`, built on the branch `007-item-view-count`; the owner tags `v0.7.0` after the merge and content-api takes it in its spec 021 (directly, so one deploy brings both `sort` and `view_count`).

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
