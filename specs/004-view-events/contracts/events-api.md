# Events API (public, additive in 0.4.0)

What a platform calls to report views and link clicks, and what the SDK sends. The service's side is content-api's `events-v1` (read only): `specs/014-save-events/contracts/events-v1.md` there.

## On the page (`window.contentSdk`, after the script tag has loaded)

```js
// after rendering an item into `element` (a framework ref callback, say)
const stop = window.contentSdk.watchView(element, item, { placementId: "latest", actorRef: "device-abc" });
// later, if the card is taken away before it was seen:
stop();

// when the visitor follows the item's link out
window.contentSdk.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc" });

// before the script has loaded: the queue form (a queued watchView cannot give a stop back)
window.contentSdk.q.push(["watchView", element, item, { placementId: "latest" }]);
window.contentSdk.q.push(["trackLinkClick", item]);
```

| Argument | Rule |
|---|---|
| `element` | The element the platform rendered for the item. Anything else is one console warning and no watch |
| `item` | The item as `fetchPage` returned it. Only `item.id` is read, and it must be a UUID; any other `id` is one console warning and no event |
| `options.placementId` | Optional. The placement the item was read through. 3 to 40 characters of `a-z`, `0-9`, `-`; an invalid one is left out with one console warning |
| `options.actorRef` | Optional. Opaque text of 1 to 128 characters, no NUL; an invalid one is left out with one console warning. The SDK makes none and stores none |
| returns | `watchView` returns a `stop` function (it does nothing when called again or after the report); `trackLinkClick` returns nothing |

The platform id and the service address come from the script tag, as for `fetchPage`. Nothing throws or rejects into the page.

## As a library

```ts
import { watchView, trackLinkClick } from "content-sdk";

const target = { baseUrl: "https://content-api.example.com", platformId: "listings" };
const stop = watchView(target, element, item, { placementId: "latest" });
trackLinkClick(target, item);
```

`target` is `{ baseUrl, platformId }` (a `fetchPage` target with a `placementId` is accepted too; the placement is an option here). Without an `IntersectionObserver` (Node) `watchView` does nothing and returns a no-op `stop`.

## When a view happens

At least 50% of the element's area visible in the viewport for one continuous second. It reports once, then the watch ends. A watch that never gets there gives up after two minutes. Each call is its own watch.

## What is sent

One request per flush to `POST {baseUrl}/api/v1/events`, `text/plain`, body:

```json
{ "platform_id": "listings",
  "events": [ { "item_id": "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10", "kind": "view", "placement_id": "latest",
                "actor_ref": "device-abc", "occurred_at": "2026-11-17T08:00:00.000Z" } ] }
```

- Events wait about 2 seconds after the first was queued, leave at once when 50 are waiting, and leave when the page is hidden or being left. No request when nothing waits. Never more than 50 events in one request.
- Sent as a beacon; when the beacon is missing or refuses, once as a keep-alive `fetch`. Never retried. The answer is never read, so the SDK does not know whether the service stored the batch.
- `placement_id` and `actor_ref` appear only when given and valid, and from version 0.5.0 so does `session_id` (spec 005, [events-api-delta](../../005-session-id/contracts/events-api-delta.md)). Nothing else about the item is sent.

The optional `sessionId` (the visit, supplied by the platform) was added in version 0.5.0: see [events-api-delta](../../005-session-id/contracts/events-api-delta.md), which amends this page.

An item may also be `{ externalRef }` instead of `{ id }`, from version 0.8.0 (spec 008, [events-api-delta](../../008-external-ref-events/contracts/events-api-delta.md)), which amends this page.

An optional `eventId` (the platform's key for one event, sent as `event_id`) is offered from version 0.9.0 (spec 009, [events-api-delta](../../009-event-id/contracts/events-api-delta.md)), which amends this page.

## Not in this version

A generic `reportEvent`, a tag attribute for the actor reference, retries, deduplication by the SDK itself (the service deduplicates by an `event_id` the platform sends, offered as `eventId` from version 0.9.0), remembering the placement.
