# Data Model: Sort Option (SDK feature 006)

No new data, entity, error kind or result field. One optional input field is added.

## Query (existing, gains one field)

| Field | Type | Rule | Sent as |
|---|---|---|---|
| `sort` | `"popular" \| "newest" \| "oldest"` | optional; exactly one of the three, lower case; `undefined` or absent means none | `sort=<value>` |

Anything else (another text, other case, with spaces, empty, a number, `null`, a boolean, a list, an object) is `{ ok: false, error: { kind: "bad_query", fields: ["sort"] } }` and no request is made.

The address is built in this order: `limit`, `tag`, `language`, `q`, `sort`, `cursor`. A call without `sort` builds the address it built in 0.5.0.

## Result (unchanged)

`{ ok: true, page: { items, nextCursor } }` or `{ ok: false, error }`. Items hold the same nine fields as before (the SDK does not return the service's `view_count`; see research R10); no score is added.
