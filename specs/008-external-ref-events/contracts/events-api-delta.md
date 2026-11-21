# events API delta: `externalRef` (spec 008)

Additive within the events API of spec 004 (`specs/004-view-events/contracts/events-api.md`) and its delta of spec 005; everything not listed there is unchanged. Version `0.8.0`. Service side: content-api `specs/022-external-ref-events/contracts/events-v1-delta.md`.

## On the page and as a library

The item of `watchView` and `trackLinkClick` may be an object with an `externalRef` instead of an `id`:

```js
window.contentSdk.trackLinkClick({ externalRef: "telegram:addis_news/10234" }, { placementId: "telegram", sessionId: "s-7f3a91c2" });
const stop = window.contentSdk.watchView(element, { externalRef: "telegram:addis_news/10234" }, { placementId: "telegram" });
// through the queue:
window.contentSdk.q.push(["trackLinkClick", { externalRef: "telegram:addis_news/10234" }, { placementId: "telegram" }]);
```

```ts
type ReportedItem = { id: string; externalRef?: never } | { externalRef: string; id?: never };
```

(The type is not exported by name; the calls accept it.) A call with neither an `id` nor an `externalRef`, or with both, fails to compile.

| Item | Result |
|---|---|
| `{ id: <UUID> }` | an item event, as before |
| `{ externalRef: <valid> }` | a reference event |
| both given, even if `id` is not a UUID | no event, one warning |
| neither given | no event, one warning |
| `externalRef` not text, empty, over 128 characters, or with a character outside `A-Za-z0-9_.:/-` | no event, one warning that does not repeat the value |

`null` counts as not given. The reference is sent as given (case matters). Options (`placementId`, `actorRef`, `sessionId`) are unchanged. The SDK sends no placement the platform did not name, and no `event_id`.

## What is sent

```json
{ "external_ref": "telegram:addis_news/10234", "kind": "view", "occurred_at": "2026-11-20T08:00:00.000Z", "placement_id": "telegram", "session_id": "s-7f3a91c2" }
```

A reference event has no `item_id`; an item event has no `external_ref` and is exactly what version 0.7.0 sent.

## Guidance for platforms

- Send a stable reference made only of public identifiers (a channel name and a post number); never an email, a name or anything that identifies a person.
- Fix the reference format early: changing it later splits one thing's events in two. The service never interprets it, and two platforms using the same text are unrelated.
- A named placement must exist and be enabled on the service, or the event is dropped without a sign (204).
