# Research: Delivery Client

Decisions, alternatives and reversals for this feature. D1 to D4 were put to the owner as options with a recommendation and chosen on 2026-11-16. D5 onward are technical defaults of the plan; the owner may overrule them.

## Owner decisions

### D1. Result object, not rejection

- **Decision**: `fetchPage` always resolves to `{ ok: true, page }` or `{ ok: false, error }`. It never rejects.
- **Why**: spec FR-008 says every outcome is returned; TypeScript narrows on `ok`; a platform cannot forget a `catch`.
- **Alternatives**: resolve to the page and reject with an error class (familiar, but each call needs `try/catch` and a rejection is a throw).

### D2. One plain function, options object

- **Decision**: `fetchPage(target, query?, options?)`. The platform passes `nextCursor` back as `query.cursor`. No client object, no async iterator, no `fetchAll`.
- **Why**: "function set", no hidden state, smallest surface (principle VI).
- **Alternatives**: `createClient(target)` returning bound methods (adds a stateful object and a second concept; can be added later without breaking this).

### D3. Build outputs

- **Decision**: esbuild builds `dist/index.mjs` (ESM), `dist/index.cjs` (CommonJS) and `dist/content-sdk.js` (minified IIFE, global `ContentSdk`); `tsc --emitDeclarationOnly` writes `dist/index.d.ts`. `package.json` gets `exports` for `import`, `require` and `types`.
- **Why**: bundlers, Node 22 `import` and `require`, and a plain script tag for the later loader all work; a typed SDK needs declarations.
- **Alternatives**: same as `ad-serve-client` (CJS + one bundle, no types: weak for a typed SDK); ESM and types only (no CJS or script bundle).
- **Note**: this differs from `ad-serve-client` on purpose. Publishing to npm is out of scope; `package.json` is marked `"private": true` until the owner says otherwise.

### D4. Cancellation only through `signal`

- **Decision**: `options.signal` (an `AbortSignal`). No `timeoutMs`. Callers build timeouts with `AbortSignal.timeout(ms)`. An aborted request is a `network` error with `aborted: true`.
- **Why**: no timer code and no injected clock in the SDK; surface stays minimal.
- **Alternatives**: add `timeoutMs` (convenient, needs an injected timer and extra surface not yet required).

## Technical defaults

### D5. Error kinds

- **Decision**: seven kinds: `unknown_placement` (404), `origin_not_allowed` (403), `bad_query` (422, and the client's own check of limit, tag, language, cursor), `unavailable` (any other non-200 status, including 500 and 503), `network` (fetch rejected or the body could not be read), `contract_mismatch` (200 with a body that fails validation, or a body that is not JSON), `invalid_target` (base address, platform id or placement id wrong before sending).
- **Why**: spec FR-007 and FR-017. The spec edge case lets a bad limit be `bad_query` whether the client or service refuses it, so both are one kind. A wrong base address is not a query problem, so it gets its own kind rather than stretching `bad_query`.
- **Alternatives**: fold `invalid_target` into `bad_query` (fewer kinds; misleading name for a base address).

### D6. Request

- **Decision**: `GET`, `credentials: "omit"`, `signal` if given, no custom headers, no `mode` or `redirect` override. The address is built with `new URL`: the base address with a trailing slash ensured (so a path prefix is kept) plus `api/v1/delivery/<encoded platform>/<encoded placement>`, query set with `URLSearchParams` and only for values given. Tag and language arrays are joined with `,`.
- **Why**: FR-013 (simple cross-origin read, no pre-flight), FR-001, path-injection edge case (`encodeURIComponent` on both ids).
- **Note**: redirects are followed by the platform's `fetch` by default. The spec's "redirect or 304 is unavailable" is satisfied for any status that reaches the client; the client does not try to stop the runtime following a redirect.

### D7. Client-side checks before sending

- **Decision**: only rules the contract states exactly. Limit: whole number 1 to 50. Tags: 1 to 50 values, each 1 to 64 characters of `a-z 0-9 _ : -`. Languages: 1 to 50 values, each 1 to 16 characters and no comma. Cursor: non-empty text of at most 512 characters. An empty tag or language array, or an empty/absent cursor, is not sent. Platform and placement id: non-empty text. The service's id pattern (`^[a-z0-9-]{3,40}$`) is **not** checked, so the service stays the judge and an id it later widens works unchanged (it answers 404 anyway).
- **Why**: spec Assumptions: the service is the final judge.
- **Alternatives**: no client checks at all (a bad limit would cost a round trip; a comma inside a tag would silently split into two filters, which is a real bug, so the tag and language checks stay).

### D8. Validation of the 200 body

- **Decision**: a hand-written validator, no schema library. Required: object with `items` (array) and `next_cursor` (string or null). Each item must have `id`, `platform`, `title`, `description`, `language`, `created_at` as strings; `tags` an array of strings; `images` an array of objects whose `url` is an `http` or `https` string; `url` a string with an `http` or `https` scheme, or null. Unknown fields are dropped (the result is built field by field). One bad item fails the whole page (`contract_mismatch`); no partial pages (spec story 3, scenario 6).
- **Image field name**: the delivery contract's example shows images as `{ "url": "…" }`; the write API's input uses `key`. Delivery builds the address from the platform's base, so delivery items carry `url`. Taken from [delivery-v1.md](/Users/tsega/Documents/Git/content-api/specs/009-public-delivery-endpoint/contracts/delivery-v1.md); the contract test uses that example verbatim.
- **Scheme check**: a case-insensitive `http://` or `https://` prefix, the same form check as the service. No `new URL` parse and no rewriting; the text is returned as received. This is stricter than the service only in applying the rule to images too, which the contract says are built addresses.
- **Not checked**: string lengths, tag patterns inside items, `created_at` format. The contract does not promise them to the client; checking them would make a later widening a breaking failure.

### D9. Error bodies

- **Decision**: the status picks the kind. For 422 the client reads `error.details.fields` only if present and only to collect parameter names into `fields`. Shape confirmed in content-api (read only: `src/services/apiError.ts`, `src/services/deliveryService.ts`, 2026-11-16): `details` is `{ fields: [{ field, message }] }`, and the delivery names are `limit`, `tag`, `language` and `cursor`. The client takes each `field` that is a string and ignores anything else. The service's `message` is kept as `serviceMessage` plain text for debugging and never decides the kind. A body that cannot be parsed does not change the kind.
- **Why**: FR-009, FR-010, proxy-page edge case. The delivery contract says only "details name the parameter"; the shape above is what the service does today, not a promise, so extraction stays tolerant and best effort.

### D10. Time

- **Decision**: `created_at` stays the text received.
- **Alternatives**: convert to `Date` (a non-plain value, and a failure path for a bad date).

### D11. Test environment

- **Decision**: two Jest projects. `node` (Node 22 has `fetch`, `URL`, `AbortSignal`) runs everything including the headless and live tests; `jsdom` runs the unit and contract tests again as the "browser-like environment" of SC-002. `jest-environment-jsdom` is a test-only dev dependency, which `ad-serve-client` already uses. Unit tests inject a fake `fetch`. The live test is skipped unless `CONTENT_SDK_LIVE=1`, and is the only test that touches the network; it needs the allowed origin, which Node cannot send as a browser would, so it checks the no-`Origin` path (served per contract) only. Checking the allowed-origin path in a real browser is a manual step in [quickstart.md](quickstart.md).
- **Why**: `ad-serve-client` uses jsdom because it renders; this SDK must not touch the DOM, so Node is the stricter check (SC-006), and jsdom adds the browser-like run SC-002 asks for. A real browser is still a manual check (SC-007).

### D12. Image address strictness (known risk)

- **Decision**: an image whose address is not `http` or `https` fails the whole page (spec FR-012, story 4). The contract says images are built from the platform's image base address but not which schemes that may hold, so a platform with an odd base would break its own page. Kept because the spec requires it; T036 checks the hosted service's real image addresses. If a real platform trips on it, relax it here first and record the reversal.

## Reversals

- Build output: the plan had `dist/types` copied to one `dist/index.d.ts`; that would break its imports, so `tsc` now emits declarations straight into `dist/` (`index.d.ts` plus the files it imports).
- Ids `.` and `..` are refused as `invalid_target`: the URL parser folds them into the path even when percent-encoded.

- Spec 002 replaced the `ContentSdk` browser global with the `contentSdk` loader (002 research D2); quickstart step 4 now points at the 002 page.

## Review of PR 1 (2026-11-16)

Applied: `--passWithNoTests` removed; a `baseUrl` with a query or fragment is `invalid_target` instead of being dropped silently; `limit` bounds and list-size limit have separate constants; one shared `isRecord` in `src/guards.ts` (arrays are not records).

Left as is, on purpose: one bad image or link fails the whole page (spec FR-012, D12); a 2xx other than 200 is `unavailable` (spec Assumptions); `aborted` is read from the signal after a failure, so a real network error followed closely by the caller's timeout reports as cancelled (rare, still a `network` error); an error body is read in full before the 500-character cut; the IIFE bundle is not in `exports` while the package is private.

## Verification (2026-11-16)

- `npm run lint`, `npm run typecheck`, `npm test` pass in both Jest projects (node, jsdom): 19 suites, 318 tests.
- `npm run build` gives `index.mjs`, `index.cjs`, `index.d.ts`, `content-sdk.js`; the three bundles load and expose `fetchPage` (ESM, CJS, IIFE `ContentSdk`).
- `package.json` has no `dependencies`; no `document`, `window` or `innerHTML` in `src`.
- Live check against `https://content-api-test.onrender.com` (listings/latest, no `Origin`): 3 of 3 pass. The allowed-origin browser check (quickstart step 4) is left to the owner.

## Gap check (T040)

FR-001 to FR-019 and SC-001 to SC-006 have code and tests. Known limits: SC-007's allowed-origin path is manual; a non-function `options.fetch` falls back to the global `fetch` instead of failing; image and link addresses are checked for an `http`/`https` form only (D8, D12).
