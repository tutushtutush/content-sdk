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

The query is the one `fetchPage` takes (`limit`, `tags`, `languages`, `cursor`); pass `page.nextCursor` back as `cursor` for the next page. Nothing here throws into your page: a bad call is a typed error in the result, a bad queue entry or a throwing callback is one console warning. All text in the result is untrusted; set it through your framework's escaping.

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

`fetchPage` never throws or rejects. Every outcome is `{ ok: true, page }` or `{ ok: false, error }`. All text in an item (title, description, tags, addresses) is untrusted: set it through your framework's escaping, never build HTML from it.

## Errors

| `error.kind` | When |
|---|---|
| `unknown_placement` | 404: the platform or placement does not exist or is switched off |
| `origin_not_allowed` | 403: the page's origin is not allowed for the platform |
| `bad_query` | 422, or the SDK refused limit, tags, languages or cursor before sending; `fields` names them |
| `unavailable` | any other status (500, 503, ...) |
| `network` | the request failed or was cancelled (`aborted: true` when your signal cancelled it) |
| `contract_mismatch` | a 200 answer that does not match the contract |
| `invalid_target` | base address, platform id or placement id unusable; `fields` names it |

## Build and test

```sh
npm install
npm run lint && npm run typecheck && npm test
npm run build   # dist/: index.mjs, index.cjs, index.d.ts, and the browser file content-sdk.js (global contentSdk)
CONTENT_SDK_LIVE=1 npm test -- tests/live   # optional check against the hosted test service
```

Install from the repository at a tag: `npm install github:tutushtutush/content-sdk#<tag>`; the install runs `prepare`, which builds `dist/`.

Not published: `package.json` is `private` until the owner decides otherwise.
