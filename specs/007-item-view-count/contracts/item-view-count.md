# Contract: `view_count` on the item (SDK public API)

Additive to what a platform receives (0.7.0). Follows content-api's delivery delta (read only): `/Users/tsega/Documents/Git/content-api/specs/019-item-view-counts/contracts/delivery-v1-delta.md`.

```ts
const result = await fetchPage(target, { sort: "popular", limit: 10 });
if (result.ok) {
  for (const item of result.page.items) {
    console.log(`${item.title}: ${item.view_count} views`); // a number: show it however you like
  }
}
```

| What the service sends for an item | What the SDK returns |
|---|---|
| `view_count` a whole number of 0 or more (up to 9007199254740991) | the item with `view_count` as that number |
| `view_count` `-0` | `view_count` `0` |
| `view_count` missing, `null`, not a number, negative, a fraction, or above the largest safe integer | `{ ok: false, error: { kind: "contract_mismatch", … } }` for the whole page, no items |

- It is the number of `view` events the service has stored for the item, from every platform that reported one, not only yours. It is **raw**: a visitor who refreshes ten times can add ten. It is not a count of people and not for billing, and the service may make the rule stricter later (the number may then be lower). The SDK passes it on and never formats, adjusts or sums it, and does not add the views it reports itself.
- It is the same for every placement and does not change the order, the filters, the search or the cursor. A `popular` list is ranked from it, so it is the number to show beside a popular post.
- A page without it is refused, not defaulted: the field is part of the service's contract. Code that builds `Item` values by hand (a platform's own tests or mocks) needs the field because the exported type requires it.

Everything else about the items, the request, the errors and the script tag is unchanged. Through the script tag, the page's callbacks and promises receive the same page, with `view_count` on each item.
