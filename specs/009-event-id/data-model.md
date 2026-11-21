# Data Model: The Event Key

The SDK holds no data of its own. This feature adds one optional key to the options it reads and one optional key to the event it builds.

## Options (input, per call)

| Option | Type | Rule |
|---|---|---|
| `eventId` | text, optional | The platform's key for this event: 1 to 128 characters of `A-Za-z0-9_.:-` (no slash, no space), case kept. `undefined` and `null` mean none. Anything else is left out with one warning |

`placementId`, `actorRef` and `sessionId` keep their rules and are independent of it.

## Event (output, as sent)

| Key | When present |
|---|---|
| `event_id` | Only when a valid `eventId` was given for that call, exactly as given, on an item event or a reference event. Otherwise absent (not `null`) |

The other keys are unchanged.

## State

None. No variable outlives a call; nothing is stored, generated or remembered. A repeated call with no key is reported again.

## Relation to content-api

The service stores `event_id` (nullable) and keeps one event per `(platform, event_id)` across item and reference events (spec 016, spec 022): the first stored wins, later ones are ignored with the same `204`; an event dropped by the service's rules does not use up its key; a key that breaks the rule makes the whole batch `422`. An older service ignores an unknown field, so the SDK may send it before the service takes it.
