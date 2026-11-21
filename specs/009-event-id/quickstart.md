# Quickstart: validating the event key

Prerequisites: Node 22 and `npm ci` in this repository. Contract: [events-api-delta](contracts/events-api-delta.md). Shapes: [data-model](data-model.md).

## 1. Automated

```sh
npm run typecheck && npm run lint && npm test      # unit, contract and jsdom tests of the built script
npm run build                                      # dist/content-sdk.js must stay within 1 KB of 14,295 bytes
```

## 2. What the tests show

Through `createReporter` over a fake transport:

- `trackLinkClick(item, { eventId: "k-1" })` sends an event with `event_id: "k-1"`; the same for a view, and for `{ externalRef }`.
- `trackLinkClick(item, {})` sends none; `eventId: null` sends none and warns nothing.
- `trackLinkClick(item, { eventId: "a/b" })` sends the event without a key and warns once, without the value.
- the same call twice with no key sends two events; the SDK skips nothing.
- a lifecycle touches no storage, cookie or random source.

## 3. Against the hosted test service (the owner's check, after content-api takes this version)

```js
window.contentSdk.q.push(["trackLinkClick", item, { placementId: "latest", eventId: "check-1" }]);
window.contentSdk.q.push(["trackLinkClick", item, { placementId: "latest", eventId: "check-1" }]);
```

Then in Neon one row has `event_id` `check-1`, not two. Nothing is published or tagged by this change; the owner tags `v0.9.0` after the merge.
