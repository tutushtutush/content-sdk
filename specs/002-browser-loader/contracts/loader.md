# Contract: browser loader (v0.2)

The loader's own public surface. Documented before the code (constitution IV). Delivery client types and errors are in [001 public-api](../../001-delivery-client/contracts/public-api.md); this contract adds only what a platform sees on the page.

## Embedding

```html
<script>window.contentSdk = window.contentSdk || { q: [] };</script>
<script async src="https://<service>/content-sdk.js"
        data-api-base-url="https://content-api.example.com"
        data-platform-id="listings"></script>
```

| Attribute | Meaning |
|---|---|
| `data-api-base-url` | The content-api address. Required, not blank. Read once at load |
| `data-platform-id` | The platform id. Required, not blank. One platform per page. Read once at load |

The stub line is optional: without it the script creates `window.contentSdk` itself, but calls made before it loads then have no queue to wait in.

## Commands

### `fetchPage(placementId, query, callback)`

| Argument | Type | Notes |
|---|---|---|
| `placementId` | string | The placement to read |
| `query` | `{ limit?, tags?, languages?, cursor? }` or omitted | As the 001 `Query`; bad values come back as a typed `bad_query` result, not an exception |
| `callback` | `(result) => void` or omitted | Receives the 001 `Result` once: `{ ok: true, page }` or `{ ok: false, error }` |

Before load: `window.contentSdk.q.push(["fetchPage", "latest", { limit: 5 }, callback])`.
After load: `window.contentSdk.fetchPage("latest", { limit: 5 }, callback)` returns a `Promise<Result>` with the same result. Pushing onto `q` after load also still works (it returns no promise).

## Guarantees

1. **Never throws or rejects into the page.** Bad arguments, unknown commands, malformed queue entries, a throwing callback and a failing network each give a typed result or one warning.
2. **Order.** Queued commands start in the order pushed. Callbacks fire as each answer arrives.
3. **Callback isolation.** A missing, non-function, throwing or rejecting callback changes nothing for other commands, other callbacks or the returned promise.
4. **One global**, `contentSdk`, with members `q` and `fetchPage`. Nothing else is added to the page.
5. **Reads the page only to find its own script tag and its two attributes**, once. Creates no element, injects no style, sets no cookie, uses no storage, sends nothing beyond the delivery client's requests.
6. **Same result as the delivery client**: unchanged, including the error kinds.
7. **Second load** on one page is ignored with one warning.

## Warnings (console `warn`, fixed text)

| When | Text |
|---|---|
| attribute missing or blank | `[content-sdk] Missing <names> on the content-sdk <script> tag. Nothing will be fetched.` where `<names>` is `data-api-base-url`, `data-platform-id`, or `data-api-base-url and data-platform-id` |
| second load | `[content-sdk] The script was loaded twice; the second load was ignored.` |
| unknown command | `[content-sdk] Unknown command: <name>` (name clipped to 40 characters) |
| bad queue entry | `[content-sdk] Bad queue entry: expected [name, ...args].` |
| callback threw or rejected | `[content-sdk] A fetchPage callback threw: <message>` (clipped to 200 characters) |
| a command threw (not expected; last guard) | `[content-sdk] Command <name> failed: <message>` (name clipped to 40, message to 200 characters) |
| the loader failed while starting (not expected; last guard) | `[content-sdk] The loader failed to start: <message>` (clipped to 200 characters) |

## The file

| | |
|---|---|
| Built file | `dist/content-sdk.js`: one minified script with `dist/content-sdk.js.map` beside it |
| Node path | `require.resolve("content-sdk/browser")` gives the file's absolute path. The bare `content-sdk` is still the library entry (`import` / `require` / types), unchanged from 001 |
| Install | `npm install github:tutushtutush/content-sdk#<tag>` runs `prepare`, which builds `dist/` |
| Serving | Done by content-api (a separate spec there); the file is read once at startup |

## Versioning

- The global name, the two attributes, the command names and arguments, the warning texts and the `content-sdk/browser` path are public. Changing or removing any of them is a major version; adding a command, an attribute or a result field is a minor version.
- `0.2.0` is the first version with the loader. The tag and any publish are the owner's call; the package stays `private` until then.
- The 001 global `ContentSdk` is removed in 0.2.0 (nothing consumed it; research D2).

## Contract tests

| Case | Source |
|---|---|
| attribute reading, trimming, blank, missing, both missing | unit, fake env |
| queue replay: 20 commands in order; command pushed during replay; push after load | unit, fake env |
| unknown command, empty entry, non-array entry, `constructor` / `__proto__` as a name | unit |
| callback missing, not a function, throws, rejects | unit |
| double load; no stub; `q` not an array | unit |
| built file in a jsdom page with the stub and a fake `fetch`: data comes back; missing attribute gives one warning | `tests/browser` |
| `require.resolve("content-sdk/browser")`; `import` / `require` of the bare name still work | build check script |
