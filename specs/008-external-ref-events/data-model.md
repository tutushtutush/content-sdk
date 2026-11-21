# Data Model: External-Reference Events

The SDK holds no data of its own. This feature widens the item the caller passes and changes one key of the event it builds.

## Item (input, per call)

| Shape | Meaning |
|---|---|
| `{ id }` | An item of content-api: `id` a UUID, as `fetchPage` returns it. As before |
| `{ externalRef }` | Something the platform does not store here: opaque text of 1 to 128 characters of `A-Za-z0-9_.:/-`, case kept |

A field is *given* when it is neither `undefined` nor `null`. Exactly one must be given. Both given (even if `id` is not a UUID), or neither, records no event and warns once. Other keys of the item are ignored.

## Event (output, as sent)

| Key | When present |
|---|---|
| `item_id` | An item event only |
| `external_ref` | A reference event only, exactly as given |

Exactly one of the two is present. `kind`, `occurred_at`, `placement_id`, `actor_ref` and `session_id` are unchanged and work the same for both. No `event_id`.

## State

None.

## Relation to content-api

The service stores `external_ref` with the event (spec 022); it looks nothing up, raises no counter, never returns it. A named placement must exist and be enabled or the event is dropped (204).
