# Data Model: Search Option

No stored data. One public type changes.

## Query (existing, in `src/types.ts`)

| Field | Type | Rule |
|---|---|---|
| `limit` | number | unchanged |
| `tags` | string[] | unchanged |
| `languages` | string[] | unchanged |
| `cursor` | string | unchanged; tied by the service to the `q` it was made for |
| `q` (new) | string | optional. Text. Empty or only spaces: treated as not given. More than 100 characters after trimming (characters, not bytes): `bad_query` naming `q`, no request. Otherwise sent unchanged as the `q` parameter |

## Result, Page, Item, error kinds

Unchanged. A refused `q` is the existing `bad_query` error with `fields: ["q"]`.
