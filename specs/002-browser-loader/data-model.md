# Data Model: Browser Bundle and Loader

Plain data and one global object. The delivery client's types (Target, Query, Result, Page, Item, DeliveryError) are as in [001 data-model](../001-delivery-client/data-model.md) and are not repeated.

## Page inputs (read, never written by the SDK except `window.contentSdk`)

### Script tag attributes (read once, at load)

| Attribute | Rule | If bad |
|---|---|---|
| `data-api-base-url` | Text, not empty after trimming. Whether it is a usable `http`/`https` address is the delivery client's check, per call (`invalid_target`) | Counts as missing in the one warning |
| `data-platform-id` | Text, not empty after trimming. Used as given (trimmed) | Counts as missing in the one warning |

### Settings (internal)

| Field | Type | Notes |
|---|---|---|
| `baseUrl` | string | Trimmed `data-api-base-url` |
| `platformId` | string | Trimmed `data-platform-id` |

Fixed for the life of the page; never re-read.

## The global: `window.contentSdk`

| Member | Type | Before load | After load |
|---|---|---|---|
| `q` | array of Command | Pages push commands here | Still an array; `push` now runs each pushed command at once |
| `fetchPage` | `(placementId, query?, callback?) => Promise<Result>` | absent | present |

No other member is added. If the page created the object, the SDK reuses it; if not, the SDK creates `{ q: [] }`.

### Command (queue entry)

`[name, ...args]` where `name` is a string in the command table. Today the table has one name: `"fetchPage"`, with args `placementId, query, callback`.

| Entry | Result |
|---|---|
| `["fetchPage", "latest", { limit: 5 }, cb]` | runs; `cb(result)` |
| `["fetchPage", "latest"]` | runs; no callback; result goes nowhere |
| `["nope"]`, `[]`, `"x"`, `null`, `[5]` | one warning, skipped |

## Callback

`(result: Result) => unknown`. Called once with the 001 result (success or typed error). A non-function is ignored. A throw or a rejected returned promise gives one warning and nothing else.

## Warnings (console, `warn` level, fixed text)

| When | Text |
|---|---|
| attributes missing or blank | `[content-sdk] Missing <data-api-base-url and/or data-platform-id> on the content-sdk <script> tag. Nothing will be fetched.` |
| second load | `[content-sdk] The script was loaded twice; the second load was ignored.` |
| unknown command | `[content-sdk] Unknown command: <name clipped to 40 characters>` |
| bad queue entry (not an array, empty, name not text) | `[content-sdk] Bad queue entry: expected [name, ...args].` |
| a command threw (last guard) | `[content-sdk] Command <name> failed: <message>` |
| the loader failed while starting (last guard) | `[content-sdk] The loader failed to start: <message>` |
| callback threw or rejected | `[content-sdk] A fetchPage callback threw: <message clipped to 200 characters>` |

The exact strings are in [contracts/loader.md](contracts/loader.md).

## State

| State | Where | Lifetime |
|---|---|---|
| Settings | closure of `install` | the page |
| Methods and `q` | `window.contentSdk` | the page |

The loader stores nothing outside the page (no cookie, no storage) and sends nothing beyond the delivery client's requests.
