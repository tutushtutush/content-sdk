# Data Model: Report the Visit with a Session Id

The SDK holds no data of its own. This feature adds one optional field to the event it builds and one optional key to the options it reads.

## Options (input, per call)

| Option | Type | Rule |
|---|---|---|
| `sessionId` | text, optional | The visit the event belongs to, chosen by the platform: 1 to 128 characters (counted as characters), no NUL. `undefined` and `null` mean none. Anything else is left out with one warning |

`placementId` and `actorRef` keep their rules and are independent of it.

## Event (output, as sent)

| Key | When present |
|---|---|
| `session_id` | Only when a valid `sessionId` was given for that call, exactly as given. Otherwise the key is absent (not `null`) |

The other keys (`kind`, `item_id`, `occurred_at`, `placement_id`, `actor_ref`) are unchanged.

## State

None. No variable outlives a call, and nothing is stored in a cookie, storage or elsewhere. A `sessionId` applies to the event of the call it came with, and the next call without one sends none.

## Relation to content-api

The service stores it as `event.session_id` (content-api spec 017): nullable text, 1 to 128 characters, no NUL, part of no key, never returned. An older service ignores an unknown field, so the SDK may send it before the service takes spec 017.
