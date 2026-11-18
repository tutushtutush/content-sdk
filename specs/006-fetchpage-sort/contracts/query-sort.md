# Contract: the `sort` option of `fetchPage` (SDK public API)

Additive to the SDK's public API (0.6.0). Follows content-api's delivery contract delta (read only): `/Users/tsega/Documents/Git/content-api/specs/020-delivery-sort/contracts/delivery-v1-delta.md`.

```ts
// a home page of popular posts from any category
const popular = await fetchPage(target, { sort: "popular", limit: 10 });
// the next page of the same list: the same sort (and q) with the cursor
await fetchPage(target, { sort: "popular", limit: 10, cursor: popular.ok ? popular.page.nextCursor ?? undefined : undefined });
// a search page keeps the service's own order: send no sort
await fetchPage(target, { q: "toyota corolla" });
```

| Input | Behavior |
|---|---|
| `sort` absent or `undefined` | no `sort` sent; the service's order (newest first, best match first with `q`) |
| `sort` is `"popular"`, `"newest"` or `"oldest"` | sent unchanged as `sort` |
| `sort` any other text (other case, spaces, `""`, another word) | `{ ok: false, error: { kind: "bad_query", fields: ["sort"] } }`, no request |
| `sort` not text (number, boolean, list, object, `null`) | the same `bad_query` result |
| the service refuses a `sort` or a `cursor` (`422`) | `bad_query` with the field names the service gave |

The result, the item fields and the error kinds are unchanged (the SDK does not return the service's `view_count`; it ignores fields it does not know). The order, and what `popular` means, are the service's. With `q` and a `sort`, the service returns only the matches in that order (to keep best match first, send no `sort`). A cursor belongs to the order (and the `q`) that made it; the SDK passes it through and remembers nothing, and the service refuses a cursor of another order with `422` naming `cursor`. A `popular` list is ranked as of its first page, and a change in an item's `view_count` between two pages can repeat or skip an item: the service's known limit, passed on as is.

Through the script tag, the same query is accepted by `window.contentSdk.fetchPage(placementId, { sort }, callback)` and by a queued `["fetchPage", placementId, { sort }, callback]`.
