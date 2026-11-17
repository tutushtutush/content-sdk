# events-api delta: `sessionId` (spec 005)

Additive within the events API of spec 004 (`specs/004-view-events/contracts/events-api.md`); everything not listed there is unchanged. Version `0.5.0`.

## On the page and as a library

The options of `watchView` and `trackLinkClick` gain one optional key:

```js
window.contentSdk.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc", sessionId: "s-7f3a91c2" });
const stop = window.contentSdk.watchView(element, item, { sessionId: "s-7f3a91c2" });
// through the queue, the same options:
window.contentSdk.q.push(["trackLinkClick", item, { sessionId: "s-7f3a91c2" }]);
```

```ts
interface ViewOptions {
  placementId?: string;
  actorRef?: string;
  /** The visit this belongs to, chosen by the platform: 1 to 128 characters, no NUL. The SDK makes none and stores none. */
  sessionId?: string;
}
```

| Option | Rule |
|---|---|
| `sessionId` | Text of 1 to 128 characters (counted as characters) with no NUL, sent as given. `undefined` and `null` mean none. An invalid one is left out with one console warning that does not repeat the value, and the event is still reported |

## What is sent

The event gains `session_id` (the same text), present only when a valid `sessionId` was given for that call:

```json
{ "kind": "view", "item_id": "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10", "occurred_at": "2026-11-17T08:00:00.000Z", "placement_id": "latest", "actor_ref": "device-abc", "session_id": "s-7f3a91c2" }
```

An event with no `sessionId` is exactly what version 0.4.0 sent.

## Guidance for platforms

- Give the SDK the id of the visit you already have, on each call; the SDK keeps nothing between calls.
- Send a random or hashed value, never an email, a name or anything that identifies a person. The service cannot tell the difference and keeps what it is sent.
- `actorRef` stays the user or device; `sessionId` is the visit. They are independent.

## Not in this version

No generated or default session id, no storage or cookie, no `eventId` option or generated event id (the SDK does not retry), no global setting or tag attribute.
