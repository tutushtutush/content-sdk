# Data Model: Item View Count (SDK feature 007)

No new entity, option, error kind or request parameter. One field is added to the item the SDK returns.

## Item (existing, gains one field)

| Field | Type | Rule | Source |
|---|---|---|---|
| `id`, `platform`, `title`, `description`, `language`, `created_at` | text | unchanged | the service |
| `tags` | list of text | unchanged | the service |
| `images` | list of `{ url }` | unchanged | the service |
| `url` | text or `null` | unchanged | the service |
| **`view_count`** | number | **required**; a whole number of 0 or more, at most the largest safe integer (9007199254740991); `-0` is returned as `0` | the service (content-api spec 019) |

The item is built field by field; nothing else the service sends reaches it.

## Good and bad values of `view_count`

| Value | Result |
|---|---|
| `0`, `1`, `7`, `1204`, `9007199254740991` | returned as given |
| `-0` | returned as `0` |
| missing, `null` | the whole page is `contract_mismatch` |
| text (including `"5"`), boolean, list, object | the same |
| negative, a fraction (`1.5`), a number above 9007199254740991 (`2**53`, `1e300`) | the same |

The message of the error is `The answer does not match the contract: item view_count is not a whole number of 0 or more`, with kind `contract_mismatch` and the status of the answer, like every other shape error. No items are returned.

## Page and result (unchanged)

`{ ok: true, page: { items, nextCursor } }` or `{ ok: false, error }`, with the same error kinds as before.
