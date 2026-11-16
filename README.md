# content-sdk

Headless browser SDK for content-api. It reads the service's public delivery endpoint and hands your platform **plain data**; you render it with your own components. No UI, no DOM, no runtime dependencies. Works in browsers and Node 22.

Public API contract: [specs/001-delivery-client/contracts/public-api.md](specs/001-delivery-client/contracts/public-api.md).

## Use

```ts
import { fetchPage, type Query } from "content-sdk";

const target = { baseUrl: "https://content-api.example.com", platformId: "listings", placementId: "latest" };

let query: Query = { limit: 20, tags: ["cars"], languages: ["am"] };
for (;;) {
  const result = await fetchPage(target, query, { signal: AbortSignal.timeout(10_000) });
  if (!result.ok) {
    console.warn(result.error.kind, result.error.message);
    break;
  }
  show(result.page.items); // your rendering
  if (result.page.nextCursor === null) break;
  query = { ...query, cursor: result.page.nextCursor };
}
```

`fetchPage` never throws or rejects. Every outcome is `{ ok: true, page }` or `{ ok: false, error }`. All text in an item (title, description, tags, addresses) is untrusted: set it through your framework's escaping, never build HTML from it.

## Errors

| `error.kind` | When |
|---|---|
| `unknown_placement` | 404: the platform or placement does not exist or is switched off |
| `origin_not_allowed` | 403: the page's origin is not allowed for the platform |
| `bad_query` | 422, or the SDK refused limit, tags, languages or cursor before sending; `fields` names them |
| `unavailable` | any other status (500, 503, ...) |
| `network` | the request failed or was cancelled (`aborted: true` when your signal cancelled it) |
| `contract_mismatch` | a 200 answer that does not match the contract |
| `invalid_target` | base address, platform id or placement id unusable; `fields` names it |

## Build and test

```sh
npm install
npm run lint && npm run typecheck && npm test
npm run build   # dist/: index.mjs, index.cjs, index.d.ts, content-sdk.js (global ContentSdk)
CONTENT_SDK_LIVE=1 npm test -- tests/live   # optional check against the hosted test service
```

Not published: `package.json` is `private` until the owner decides otherwise.
