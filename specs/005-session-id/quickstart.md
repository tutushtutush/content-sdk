# Quickstart: validating the session id

Prerequisites: Node 22 and `npm ci` in this repository. Contract: [events-api-delta](contracts/events-api-delta.md). Shapes: [data-model](data-model.md).

## 1. Automated

```sh
npm run typecheck && npm run lint && npm test      # unit, contract and jsdom tests of the built script
npm run build                                      # dist/content-sdk.js must stay within 1 KB of 13,146 bytes
```

## 2. What the tests show

The event builder is internal, so the visible check is the payload the reporter hands to the transport. In the unit tests, `createReporter` over a fake transport shows:

- `trackLinkClick(item, { sessionId: "s-7f3a" })` sends an event with `session_id: "s-7f3a"`.
- `trackLinkClick(item, {})` sends one with no `session_id` key.
- `trackLinkClick(item, { sessionId: "" })` sends one without it and warns once (the warning never holds the value).

## 3. In a page, against the hosted test service (the owner's check, after content-api serves this version)

```html
<script>window.contentSdk = window.contentSdk || { q: [] };</script>
<script async src="https://content-api-test.onrender.com/content-sdk.js"
        data-api-base-url="https://content-api-test.onrender.com" data-platform-id="listings"></script>
<script>
  window.contentSdk.q.push(["trackLinkClick", item, { placementId: "latest", sessionId: "s-test-1" }]);
</script>
```

Then in Neon: `select kind, session_id from event order by id desc limit 3` shows `s-test-1` on the new row. This works only after content-api takes SDK `0.5.0` and is deployed; the SDK's own change is checked by step 1.

Nothing is published or tagged by this change; the owner tags `v0.5.0` after the merge.
