# content-sdk

Headless browser SDK for content-api. It reads the service's public delivery endpoint and hands your platform **plain data**; you render it with your own components. No UI, no DOM, no runtime dependencies. Works in browsers and Node 22.

Public API contract: [specs/001-delivery-client/contracts/public-api.md](specs/001-delivery-client/contracts/public-api.md).

## Embedding (script tag)

Paste the stub and the script once per page:

```html
<script>window.contentSdk = window.contentSdk || { q: [] };</script>
<script async src="https://<service>/content-sdk.js"
        data-api-base-url="https://content-api.example.com"
        data-platform-id="YOUR_PLATFORM_ID"></script>
```

- `data-api-base-url`: the content-api address.
- `data-platform-id`: your platform id. One platform per page. Both attributes are read once, from the script's own tag, when it loads.

If either is missing or blank, the script logs one console warning and does nothing else (nothing is created, replayed or fetched):

```
[content-sdk] Missing data-api-base-url and data-platform-id on the content-sdk <script> tag. Nothing will be fetched.
```

Then ask for a page. Before the script has loaded, push onto the queue; commands run in the order pushed once it loads. After it has loaded, call the method; it also returns a promise of the same result.

```js
// before or after load: the callback gets { ok: true, page } or { ok: false, error }
window.contentSdk.q.push(["fetchPage", "latest", { limit: 5 }, (result) => show(result)]);

// after load only
const result = await window.contentSdk.fetchPage("latest", { limit: 5, tags: ["cars"] });
```

The query is the one `fetchPage` takes (`limit`, `tags`, `languages`, `q`, `cursor`); pass `page.nextCursor` back as `cursor` for the next page. Nothing here throws into your page: a bad call is a typed error in the result, a bad queue entry or a throwing callback is one console warning. All text in the result is untrusted; set it through your framework's escaping.

The script only reads its own tag. It creates no element, injects no style, and sets no cookie or storage. Full contract: [specs/002-browser-loader/contracts/loader.md](specs/002-browser-loader/contracts/loader.md).

The built file is `dist/content-sdk.js` (minified, with `content-sdk.js.map`). A Node program finds it with `require.resolve("content-sdk/browser")`; the bare `content-sdk` is still the library below.

## Use as a library

```ts
import { fetchPage, type Query } from "content-sdk";

const target = { baseUrl: "https://content-api.example.com", platformId: "listings", placementId: "latest" };

let query: Query = { limit: 20, tags: ["cars"], languages: ["am"] };
for (;;) {
  const result = await fetchPage(target, query, { signal: AbortSignal.timeout(10_000) });
  if (!result.ok) {
    console.warn(result.error.kind, result.error.message);
    break;
  }
  show(result.page.items); // your rendering
  if (result.page.nextCursor === null) break;
  query = { ...query, cursor: result.page.nextCursor };
}
```

### An item and its view count

Each item is plain data with these fields: `id`, `platform`, `title`, `description`, `language`, `tags`, `images` (each with a `url`), `created_at`, `url` (the poster's own link out of the post, or `null`) and `view_count`.

```ts
for (const item of result.page.items) {
  show(`${item.title}: ${item.view_count} views`); // the wording, and any thousands separator, are yours
}
```

`view_count` is a whole number of 0 or more: how many times the service has stored a view of the item, `0` when none. Read it with these limits in mind:

- **It is raw.** Every stored view counts, so a visitor who refreshes the page ten times can add ten. It is not a count of people and not for billing, and the service may make its rule stricter later, so the number could then be lower than before.
- **It includes views reported by other platforms**, not only yours or the item's owner's.
- **It is the service's number.** The SDK passes it on as it was sent and never formats, rounds, sums or adjusts it, and it does not add the views your page reports through `watchView`.
- **It is required.** A page whose item has no `view_count`, or one that is not a whole number of 0 or more (text, `null`, a negative number, a fraction, more than the largest safe integer), is refused whole as a `contract_mismatch` error, with no items and nothing guessed.
- **Code that builds `Item` values by hand** (your own tests or mocks) needs the field, because the exported type requires it.

### Search

Add `q`, the words a visitor typed, to search the placement's items:

```ts
const result = await fetchPage(target, { q: "toyota corolla", limit: 10 });
// the next page of the same search: the same q with the cursor
const next = await fetchPage(target, { q: "toyota corolla", limit: 10, cursor: page.nextCursor });
```

`q` is text of at most 100 characters after trimming (characters, not bytes). Empty or only spaces means no search, so an empty search box needs no special case. It is sent as typed. The service decides what matches and in what order (every word must match a word or the start of one, case is ignored, best match first), so the SDK only passes it on and returns the items as they come. A cursor belongs to the search it came from: pass the same `q` with it, or the service refuses it. A `q` that is not text or is too long is a `bad_query` error naming `q`, without a request; a text with no word in it is refused by the service the same way. The script tag takes the same option: `window.contentSdk.fetchPage("latest", { q: "toyota" })`, or queued.

`fetchPage` never throws or rejects. Every outcome is `{ ok: true, page }` or `{ ok: false, error }`. All text in an item (title, description, tags, addresses) is untrusted: set it through your framework's escaping, never build HTML from it.

### Sort

Add `sort` to choose the order of a page, per call. It takes one of three values, in lower case:

| `sort` | Order |
|---|---|
| `"popular"` | the most viewed first, with older items counting for less (a home page of popular posts from any category) |
| `"newest"` | newest first |
| `"oldest"` | oldest first |

```ts
// a home page of popular posts, and a search page that keeps the service's own order
const home = await fetchPage(target, { sort: "popular", limit: 10 });
const found = await fetchPage(target, { q: "toyota corolla" });
// the next page of the home list: the same sort (and the same q, if any) with the cursor
const more = await fetchPage(target, { sort: "popular", limit: 10, cursor: home.ok ? home.page.nextCursor ?? undefined : undefined });
```

- **No `sort` keeps the service's order** (newest first, or best match first with `q`). The SDK adds no default and remembers nothing between calls, so send `sort` on every call that wants one.
- **A cursor belongs to the order, and the `q`, that made it.** Pass the same `sort` and `q` while paging; the service refuses a cursor used with another order, and the SDK returns that as a `bad_query` error naming `cursor`.
- **With `q` and a `sort`, only the matches come back, in the order you asked for.** To keep best match first, send no `sort`.
- **A bad `sort` is a `bad_query` error naming `sort`, without a request**: another word, a different case (`"Popular"`), spaces, an empty text, or a value that is not text. An empty text is not "no sort": leave the key out (or pass `undefined`) for the default, for example when a dropdown has a "default" choice.
- **A `popular` list is ranked as of its first page**, so time passing between two pages moves nothing. A change in an item's view count between two pages can still repeat or skip an item; fetch the list in one page (`limit` up to 50) or treat a repeat as harmless.
- The items come back as before, in the service's order; the SDK computes and returns no score.

The script tag takes the same option: `window.contentSdk.fetchPage("latest", { sort: "popular" })`, or queued.

## Errors

| `error.kind` | When |
|---|---|
| `unknown_placement` | 404: the platform or placement does not exist or is switched off |
| `origin_not_allowed` | 403: the page's origin is not allowed for the platform |
| `bad_query` | 422, or the SDK refused limit, tags, languages, q or cursor before sending; `fields` names them |
| `unavailable` | any other status (500, 503, ...) |
| `network` | the request failed or was cancelled (`aborted: true` when your signal cancelled it) |
| `contract_mismatch` | a 200 answer that does not match the contract |
| `invalid_target` | base address, platform id or placement id unusable; `fields` names it |

## Reporting views and clicks

The SDK tells content-api what visitors do with the items you show, so the service can count and rank them later. You hand it the element you rendered and the item; it renders and changes nothing itself.

```js
// after rendering an item into `element` (a framework ref callback, say)
const stop = window.contentSdk.watchView(element, item, { placementId: "latest", actorRef: "device-abc", sessionId: "s-7f3a91c2" });
stop(); // optional: cancel if the card is taken away before it was seen

// in your own click handler, when the visitor follows the item's link out
window.contentSdk.trackLinkClick(item, { placementId: "latest", actorRef: "device-abc", sessionId: "s-7f3a91c2" });

// before the script has loaded, push onto the queue as for fetchPage (a queued watchView cannot hand back a stop)
window.contentSdk.q.push(["watchView", element, item, { placementId: "latest" }]);
window.contentSdk.q.push(["trackLinkClick", item]);
```

As a library the same two functions take the target first: `watchView({ baseUrl, platformId }, element, item, options)` and `trackLinkClick({ baseUrl, platformId }, item, options)`. Without an `IntersectionObserver` (Node) `watchView` does nothing.

- **A view** is the item seen on screen: at least 50% of the element visible for one continuous second. It is reported once per `watchView` call; a card that is never seen that way is given up on after two minutes and reports nothing. **A click** is reported every time you call `trackLinkClick`. The SDK adds no listener to your elements.
- **Use it once per card.** Each `watchView` call is its own watch and the SDK does not deduplicate, so a framework that calls your ref callback on every re-render would report the same view more than once: call it once when the card is created, keep the `stop` function, and call `stop` when the card is removed. A watch gives up two minutes after it began, so in a long feed call `watchView` when a card is about to scroll into view, not when the whole list is rendered, or a card first seen later than that reports nothing.
- **A card taller than about twice the viewport can never count as seen**, because the rule is half of the element's own area (an element that size can fill the whole screen and still be under 50%). Keep that in mind for tall cards on small screens; a size-aware rule would be a later decision.
- `item` is what `fetchPage` returned, or `{ externalRef }` (below); only `item.id` or `item.externalRef` is read. An `id` must be a UUID (any other id is one console warning and no event).
- `placementId` (the placement you read the item through; 3 to 40 characters of `a-z`, `0-9`, `-`), `actorRef` (opaque text of 1 to 128 characters naming the user or device) and `sessionId` (opaque text of 1 to 128 characters naming the visit the event belongs to) are optional and sent as given. A value the service would refuse is left out with one console warning, and the event is still reported. **You supply the session id, on each call:** the SDK makes no id of its own, keeps nothing between calls and writes no cookie and no storage, so a call with no `sessionId` sends none. `actorRef` and `sessionId` are independent. Send random or hashed values for both, never an email, a name or anything that identifies a person: the service cannot tell the difference and keeps what it is sent. content-api stores the session id (its spec 017) so that counting can later tell separate visits apart.
- Events wait about two seconds after the first one, then leave together; 50 waiting events leave at once; and everything waiting leaves when the page is hidden or being left. A request holds at most 50 events and nothing is sent when nothing waits. They go as one `text/plain` beacon to `/api/v1/events` (so no pre-flight), with one keep-alive `fetch` if the browser refuses the beacon. A failed send is not retried: these events are best effort and not for billing.
- **Something that is not an item (version 0.8.0).** For a thing you keep yourself and do not store in content-api (for example a post you read live), pass `{ externalRef: "telegram:addis_news/10234" }` in place of the item, in `watchView`, `trackLinkClick` and the queue commands; the event then carries `external_ref` and no `item_id`, and the options work the same. An `externalRef` is opaque text of 1 to 128 characters of `A-Z a-z 0-9 _ . : / -`, sent as given (case matters). An item that has both an `id` and an `externalRef` (even an `id` that is not a UUID), or neither, or a bad `externalRef`, records no event and gives one console warning that never repeats the value. `null` counts as not given. **The platform must supply a stable reference made only of public identifiers** (a channel name and a post number; never an email, a name or anything that identifies a person), **and must fix its format early**: changing it later splits one thing's events in two. The SDK never looks at what it means and invents no placement: a `placementId` you name must exist and be enabled on the service, or the service drops the event without a sign.
- Nothing throws into your page; a bad call is one console warning. Full contract: [specs/004-view-events/contracts/events-api.md](specs/004-view-events/contracts/events-api.md), with `sessionId` in [specs/005-session-id/contracts/events-api-delta.md](specs/005-session-id/contracts/events-api-delta.md) and `externalRef` in [specs/008-external-ref-events/contracts/events-api-delta.md](specs/008-external-ref-events/contracts/events-api-delta.md).

## Build and test

```sh
npm install
npm run lint && npm run typecheck && npm test
npm run build   # dist/: index.mjs, index.cjs, index.d.ts, and the browser file content-sdk.js (global contentSdk)
CONTENT_SDK_LIVE=1 npm test -- tests/live   # optional check against the hosted test service
```

Install from the repository at a tag: `npm install github:tutushtutush/content-sdk#<tag>`; the install runs `prepare`, which builds `dist/`.

Not published: `package.json` is `private` until the owner decides otherwise.
