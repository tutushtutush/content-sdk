# events API delta: `eventId` (spec 009)

Additive within the events API of spec 004 (`specs/004-view-events/contracts/events-api.md`) and its deltas of specs 005 and 008; everything not listed there is unchanged. Version `0.9.0`. Service side: content-api `specs/016-event-dedup/contracts/events-v1-delta.md`.

From version 0.9.0 the `eventId` option is offered, so the line "no `eventId` option or generated event id" under "Not in this version" in the delta of spec 005 ([events-api-delta](../../005-session-id/contracts/events-api-delta.md)) is history; a generated event id is still not made (research R4).

## On the page and as a library

The options of `watchView` and `trackLinkClick` gain one optional key:

```js
window.contentSdk.trackLinkClick(item, { placementId: "latest", eventId: "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b" });
const stop = window.contentSdk.watchView(element, { externalRef: "telegram:addis_news/10234" }, { eventId: "view:telegram:addis_news.10234:k7" });
// through the queue, the same options:
window.contentSdk.q.push(["trackLinkClick", item, { eventId: "..." }]);
```

```ts
interface ViewOptions {
  placementId?: string;
  actorRef?: string;
  sessionId?: string;
  /** This event's key, chosen by the platform: 1 to 128 characters of A-Z a-z 0-9 _ . : - (no slash). The SDK makes none and keeps none. */
  eventId?: string;
}
```

| Option | Rule |
|---|---|
| `eventId` | Text of 1 to 128 characters of `A-Za-z0-9_.:-`, sent as given (case matters). `undefined` and `null` mean none. An invalid one (not text, empty, too long, a space, a slash, an accented letter, a NUL) is left out with one console warning that does not repeat the value, and the event is still reported without a key |

## What is sent

The event gains `event_id` (the same text), present only when a valid `eventId` was given for that call, on an item event and on a reference event:

```json
{ "external_ref": "telegram:addis_news/10234", "kind": "view", "occurred_at": "2026-11-21T08:00:00.000Z", "placement_id": "telegram", "event_id": "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b" }
```

An event with no `eventId` is exactly what version 0.8.0 sent.

## Guidance for platforms

- An `eventId` is **one event's key**: not a visit's (that is `sessionId`) and not a user's (that is `actorRef`).
- The service stores the first event it sees with a key (per platform, across item and reference events) and ignores later ones with the same key, with the same `204` and no sign. To make a repeated call store once, **pass the same `eventId` on the repeat**, for example a key the platform stores with the post it already reported.
- A fresh random key on every call deduplicates nothing: the SDK never retries and does not remember calls.
- Give each event its own key: a view and a click of one thing need two keys, and one key for two different events drops the second.
- Do not build a key from public values only (a post reference, an item id): a stored key blocks later events with that key from the same platform, and a browser report can be forged, so anyone could send the same key first and block yours. Use a random UUID the platform keeps, or a value it derives that others cannot.
- An event the service drops by its rules (inactive item, unknown or disabled placement) does not use up its key.
- Raw counts stay raw and are not for billing; a key removes repeats of one event, not repeated visits.
- Without a service that has taken content-api's spec 016 the field is ignored.
