# Quickstart: validating the search option

Prerequisites: `npm ci` (the build runs on install).

## Automated

```sh
npm run typecheck && npm run lint && npm test
```

Expected: all green, including the new request, fetch, no-throw, loader, bundle and contract tests for `q`, and the unchanged tests for calls without `q`.

## Against the hosted service (optional, by the owner)

The hosted service has the search option after content-api spec 012 was deployed (2026-11-17). The live test file (`tests/live/live.test.ts`, run with `CONTENT_SDK_LIVE=1 npm test`) gets one search case for a word that is certainly absent (an empty page is a success) and one `limit`-free search that must come back `ok`. A word from the existing item can be tried by hand:

```ts
await fetchPage({ baseUrl: "https://content-api-test.onrender.com", platformId: "listings", placementId: "latest" }, { q: "<a word from the item>" });
```

Expected: `ok: true` with the item for a present word, and `ok: true` with no items for a missing word.
