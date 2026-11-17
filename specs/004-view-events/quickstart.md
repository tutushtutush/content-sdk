# Quickstart: Report Views and Link Clicks

Contract: [contracts/events-api.md](contracts/events-api.md). Service side: content-api `specs/014-save-events/contracts/events-v1.md` (read only).

## Automated

```sh
npm run lint && npm run typecheck && npm test
npm run build        # dist/content-sdk.js, still one minified script; note its size
```

What the tests prove: the visibility rule (below, at and above 50%; shorter and longer than a second; hidden in between; give-up; stop), the flush rules (two seconds, 50, page hidden, no empty request), the transport (beacon, fetch fallback, no retry, no throw), the option checks (UUID, placement, actor), the loader methods and the queue form, the built script in jsdom with a fake observer, and a contract test that runs every payload through the rules of content-api's events contract. The existing tests pass unchanged.

## By hand, in a page (the owner's step, after content-api has the SDK at the new version)

1. Load the script tag as in the README, on a page whose origin the platform allows.
2. Render a card for an item you fetched, then in the console: `const stop = contentSdk.watchView(cardElement, item, { placementId: "latest" })`. Scroll it into view and keep it there for a second.
3. About two seconds later, one request to `/api/v1/events` appears in the network tab (a beacon), answered `204`. Check the `event` table in the hosted database for one `view` row.
4. `contentSdk.trackLinkClick(item, { placementId: "latest" })` and wait two seconds: one `link_click` row.
5. Look at the console while doing it: note any CORS message about credentials on the beacon (research R7) and tell me, so the follow-up decision can be made.

This repository never asks for a key or a connection string.
