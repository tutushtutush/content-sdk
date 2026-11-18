# Quickstart: validating the sort option (SDK feature 006)

Contract: [contracts/query-sort.md](contracts/query-sort.md). Types and rules: [data-model.md](data-model.md).

## Automated

```sh
npm run typecheck
npm run lint
npm test            # unit, contract, and the jsdom test of the built script
npm run build
```

Expected: all pass. The tests prove, with a fake network function:

1. Each of `popular`, `newest`, `oldest` is sent as `sort=<value>`, alone and with `limit`, `tags`, `languages`, `q` and `cursor`, in the address order `limit`, `tag`, `language`, `q`, `sort`, `cursor`.
2. A call without `sort` (absent or `undefined`) builds the address 0.5.0 built, in every existing test.
3. At least ten bad values (another word, `"Popular"`, `" popular"`, `""`, a number, `true`, `null`, a list, an object, a symbol) resolve to `bad_query` naming `sort`, never throw, and make no request.
4. A `422` naming `sort` or `cursor` from the service comes back as `bad_query` with that field, with no retry.
5. A first page with `sort`, then a second with its cursor and the same `sort`, sends both unchanged; a later call without `sort` sends none.
6. Through the built script (jsdom): a queued `fetchPage` command and a direct `window.contentSdk.fetchPage` call carry `sort`; a bad `sort` reaches the callback as `bad_query`.
7. `package.json` says version 0.6.0 and no runtime dependency was added.

## By hand against the hosted test service (owner, after the tag is taken by content-api)

```html
<script>
  window.contentSdk = window.contentSdk || { q: [] };
  window.contentSdk.q.push(["fetchPage", "latest", { sort: "popular", limit: 5 }, (result) => console.log(result)]);
</script>
```

Expected: `{ ok: true, page: { items, nextCursor } }` with the items in the service's `popular` order; with `sort: "best"` the callback gets `{ ok: false, error: { kind: "bad_query", fields: ["sort"] } }` and the network tab shows no request.
