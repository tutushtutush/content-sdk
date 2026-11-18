# Quickstart: validating the item view count (SDK feature 007)

Contract: [contracts/item-view-count.md](contracts/item-view-count.md). Rules: [data-model.md](data-model.md).

## Automated

```sh
npm run typecheck
npm run lint
npm test            # unit, contract, and the jsdom test of the built script
npm run build
```

Expected: all pass. The tests prove, with a fake network function:

1. A page whose items carry `view_count` of `0`, `1`, `7`, `1204` and the largest safe integer returns each exactly, with the other nine fields as before and the items in the service's order.
2. At least twelve bad values (missing, `null`, text, `"5"`, `true`, a list, an object, `-1`, `1.5`, `NaN`, `Infinity`, `2**53`, `1e300`) each make the whole page `contract_mismatch` with no items, and none throws; one bad item among several refuses the page.
3. `-0` is returned as `0`, and `0` is never taken for missing.
4. The count comes back with `sort`, `q`, `tags`, `languages`, `limit` and `cursor`, and no request address differs from 0.6.0.
5. The built script (jsdom) returns the count in a queued command and a direct call, and a refused page reaches the callback as `contract_mismatch`.
6. `package.json` says 0.7.0 and no runtime dependency was added.

## By hand against the hosted test service (owner, after content-api takes the tag)

```html
<script>
  window.contentSdk = window.contentSdk || { q: [] };
  window.contentSdk.q.push(["fetchPage", "latest", { sort: "popular", limit: 5 }, (result) =>
    console.log(result.ok ? result.page.items.map((i) => `${i.title}: ${i.view_count}`) : result)]);
</script>
```

Expected: a list of titles with their counts (the hosted counts add up to the events in the database), in the service's `popular` order.
