# Data Model: Report Views and Link Clicks

Nothing is stored: no cookie, no storage, no file. These are the in-memory shapes only.

## Event (in the queue, and on the wire)

| Field | Wire name | Rule |
|---|---|---|
| kind | `kind` | `"view"` or `"link_click"` |
| item id | `item_id` | The item's `id` as given, only when it is a UUID |
| placement | `placement_id` | Present only when given and valid (3 to 40 characters of `a-z`, `0-9`, `-`) |
| actor | `actor_ref` | Present only when given and valid (1 to 128 characters of text, no NUL) |
| time | `occurred_at` | The time the event happened (the moment the view completed, or the click was reported), ISO 8601 with a zone (`Date#toISOString`) |

## Batch (one request)

`{ "platform_id": <the tag's platform id>, "events": [ ...1 to 50 events ] }`, sent as the text of one `text/plain` request to `{baseUrl}/api/v1/events`.

## Watch (one element being observed)

State: `waiting` (observing, not yet half visible), `dwelling` (half visible, the one-second timer running), `done` (reported, stopped, or gave up). A watch holds the element, the item id, the options, and its observer and timers, and lets go of all of them when it is `done`.

## Batcher state

The waiting events, and one flush timer started when the first of them is queued. A flush empties the queue and stops the timer; a queue that reaches 50 flushes at once.

## Constants

`FLUSH_DELAY_MS = 2000`, `BATCH_MAX = 50`, `DWELL_MS = 1000`, `VISIBLE_RATIO = 0.5`, `GIVE_UP_MS = 120000`. One module, so a test and the code agree.
