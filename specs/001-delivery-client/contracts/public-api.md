# Contract: public API (v0, first feature)

The SDK's own public surface. Documented before the code (constitution IV). Types are in [data-model.md](../data-model.md). Anything not listed here is private and may change.

## Exports

```ts
export function fetchPage(
  target: Target,
  query?: Query,
  options?: Options,
): Promise<Result>;

export type { Target, Query, Options, Result, Page, Item, Image, DeliveryError, ErrorKind };
```

Also available as a script-tag global `ContentSdk.fetchPage` from the IIFE bundle.

## Guarantees

1. **Never rejects and never throws**, for any input or any outcome of the request: bad input, a rejected or cancelled `fetch`, an unreadable body or a body of the wrong shape each come back as a typed error. Only the awaited `fetch` call and the body read are wrapped in a catch; there is no blanket catch around the function, so a bug in the SDK itself shows up in tests instead of being hidden as an error result.
2. **One request per call**; no retry, no cache, no timer.
3. **Plain data out.** The page and every item are plain objects and arrays built field by field; no extra fields, no prototypes carried over from the parsed body.
4. **Text is unchanged.** Titles, descriptions, tags, addresses and `created_at` are returned exactly as received.
5. **No DOM, no markup, no global state**, and no read of `window`, `document` or `location`.
6. **No credentials, no custom headers.** The request is a simple cross-origin GET.
7. **Input is not modified.** Arrays in `query` are read, not changed.
8. **Refused ids.** A platform or placement id of `.` or `..` is refused as `invalid_target`; other ids are encoded into the path and cannot change it.
9. **Bounded service text.** `serviceMessage` is plain text cut to 500 characters; it never decides the error kind.

## Paging

```ts
let query: Query = { limit: 20 };
for (;;) {
  const result = await fetchPage(target, query);
  if (!result.ok) break;                 // branch on result.error.kind
  show(result.page.items);
  if (result.page.nextCursor === null) break;
  query = { ...query, cursor: result.page.nextCursor };
}
```

The cursor is opaque. Pass it back unchanged with the same filters.

## Versioning

- The SDK follows content-api `/api/v1`. A `/api/v2` is a new SDK major version or a new function, decided then.
- Additive changes to the service's response need no SDK change: unknown fields are dropped.
- Adding an error kind, an option or an item field is a minor version of the SDK; removing or renaming one, or changing what a kind means, is a major version. Platforms should handle an unknown `kind` as a generic failure.
- Until the first release the version is `0.x` and `package.json` is `private`.

## Contract tests (what the SDK is run against)

| Source | Case |
|---|---|
| `delivery-v1.md` | the 200 example body; the empty page `{"items": [], "next_cursor": null}`; 404 `unknown_placement`; 403 `origin_not_allowed`; 422 `invalid`; 503 `unavailable` |
| `item-url.md` | an item with `url: null`; an item with an `https` `url`; an item whose `url` has odd characters (`"`, `<`, `>`) which are returned unchanged |
| both | an item and a page with an extra unknown field, which must be absent from the result |
