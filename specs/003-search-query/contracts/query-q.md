# Contract: the `q` option of `fetchPage` (SDK public API)

Additive to the SDK's public API (0.3.0). Follows content-api's `search-v1` (read only): `/Users/tsega/Documents/Git/content-api/specs/012-search-q/contracts/search-v1.md`.

```ts
const result = await fetchPage(target, { q: "toyota corolla", limit: 10 });
// the next page of the same search: the same q with the cursor
await fetchPage(target, { q: "toyota corolla", limit: 10, cursor: result.ok ? result.page.nextCursor ?? undefined : undefined });
```

| Input | Behavior |
|---|---|
| `q` absent or `undefined` | no `q` sent |
| `q` empty or only spaces | no `q` sent |
| `q` text of 1 to 100 characters after trimming | sent unchanged as `q`, encoded |
| `q` over 100 characters after trimming | `{ ok: false, error: { kind: "bad_query", fields: ["q"] } }`, no request |
| `q` not text (number, object, list, `null`) | the same `bad_query` result |
| `q` the service refuses (`422`, for example symbols only) | `bad_query` with the field names the service gave |

The result, the item fields and the error kinds are unchanged. Matching, order and what counts as a word are the service's (words and word starts, case ignored, best match first). The cursor is tied to its `q`; the SDK passes both through and remembers nothing. Through the script tag, the same query is accepted by `window.contentSdk.fetchPage(placementId, { q }, callback)` and by a queued `["fetchPage", placementId, { q }, callback]`.
