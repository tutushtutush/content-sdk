# Quickstart: validating external-reference events

Prerequisites: Node 22 and `npm ci` in this repository. Contract: [events-api-delta](contracts/events-api-delta.md). Shapes: [data-model](data-model.md).

## 1. Automated

```sh
npm run typecheck && npm run lint && npm test      # unit, type, contract and jsdom tests of the built script
npm run build                                      # dist/content-sdk.js must stay within 1 KB of 13,838 bytes
```

## 2. What the tests show

Through `createReporter` over a fake transport:

- `trackLinkClick({ externalRef: "telegram:addis_news/10234" })` sends an event with `external_ref` and no `item_id`.
- `trackLinkClick({ id, externalRef })` and `trackLinkClick({})` send nothing and warn once.
- `trackLinkClick({ externalRef: "a b" })` sends nothing and warns once, without the value.
- an item event is exactly as in 0.7.0.
- the type test fails to compile for a call with neither field (`@ts-expect-error`).

## 3. Against the hosted test service (the owner's check, after content-api takes this version and the `telegram` placement exists for `listings`)

```js
window.contentSdk.q.push(["trackLinkClick", { externalRef: "telegram:addis_news/10234" }, { placementId: "telegram" }]);
```

Then in Neon the new row has `external_ref` set and `item_id` empty. Nothing is published or tagged by this change; the owner tags `v0.8.0` after the merge.
