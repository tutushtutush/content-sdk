# Quickstart: validating the delivery client

Run these after implementation to see the feature work end to end. Details of inputs and results are in [data-model.md](data-model.md) and [contracts/public-api.md](contracts/public-api.md); nothing is repeated here.

## Prerequisites

- Node 22 and `npm install` in the repository root.
- For the live check: network access to `https://content-api-test.onrender.com` (the hosted service may take a while to wake). No secrets are needed; delivery is public.

## 1. Checks and unit tests

```sh
npm run lint
npm run typecheck
npm test
```

Expected: all pass, in both the Node and the jsdom project. Tests cover request building, validation, error mapping, and `fetchPage` with a fake `fetch`, and the contract tests that use the examples from content-api's two contract files (spec FR-019).

## 2. Build

```sh
npm run build
```

Expected files in `dist/`: `index.mjs`, `index.cjs`, `index.d.ts`, `content-sdk.js`. Quick load checks:

```sh
node -e "const m=require('./dist/index.cjs'); console.log(typeof m.fetchPage)"      # function
node --input-type=module -e "import {fetchPage} from './dist/index.mjs'; console.log(typeof fetchPage)"  # function
```

Dependency check (SC-006): `package.json` has no `dependencies`; `grep -rE "document|window|innerHTML" src` finds nothing.

## 3. Live check against the hosted test service

```sh
CONTENT_SDK_LIVE=1 npm test -- tests/live
```

Expected: platform `listings`, placement `latest` returns `{ ok: true }` with a page whose items each have the nine fields, and `nextCursor` string or null. A made-up placement returns `unknown_placement`. A `limit` of 51 is `bad_query` and is not sent. This runs without an `Origin` header, which the contract serves; the allowed-origin path is step 4.

## 4. Browser check from the allowed origin (manual)

The allowed origin for the test platform is `https://listings-test-nine.vercel.app`. A browser sends `Origin` automatically, so this can only be checked from a page served from that origin (the owner decides how; nothing in listings is changed by this feature). With the IIFE bundle loaded on such a page, in the console:

```js
const r = await ContentSdk.fetchPage(
  { baseUrl: "https://content-api-test.onrender.com", platformId: "listings", placementId: "latest" },
  { limit: 5 },
);
console.log(r.ok, r.ok ? r.page.items.length : r.error.kind);
```

Expected: `true` and a number up to 5. From any other origin: `false` with `network` (a browser hides the 403 body) or `origin_not_allowed`.

## 5. Walk all pages

With the loop in [contracts/public-api.md](contracts/public-api.md) (limit 2), against the live service or a fake: every item is seen once, in order, and the loop ends when `nextCursor` is `null` (SC-005).
