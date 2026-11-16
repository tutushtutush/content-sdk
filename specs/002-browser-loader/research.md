# Research: Browser Bundle and Loader

Decisions, alternatives and reversals. D1 and D2 were put to the owner as options with a recommendation and chosen on 2026-11-16. The rest are technical defaults of the plan.

## Owner decisions

### D1. Documented file path: `content-sdk/browser`

- **Decision**: `exports` gets `"./browser": "./dist/content-sdk.js"`. content-api calls `require.resolve("content-sdk/browser")` and reads the file once. The bare `content-sdk` keeps its `import`, `require` and `types` entries from 001.
- **Why**: pointing the bare name at a script that exports nothing would break `import`/`require` (FR-016). A subpath is short, stable and does not tie content-api to the folder layout.
- **Alternatives**: `content-sdk/content-sdk.js` (same mechanism, longer); documenting `dist/content-sdk.js` only (needs a `./dist/*` export or no exports map, and ties consumers to the layout).

### D2. Replace the old `ContentSdk` global

- **Decision**: the browser file is the loader only; it creates `contentSdk` and nothing else. The 001 IIFE (`globalName: "ContentSdk"`) goes away.
- **Why**: FR-001 allows one global. Nothing consumes `ContentSdk` (0.1.0 was private and unreleased). The 001 quickstart step 4 is updated to the new snippet.
- **Alternatives**: keep both globals (breaks FR-001 and adds a second public surface).

## Technical defaults

### D3. Injected environment

- **Decision**: `install(env)` takes `{ document, console, contentSdk }`-shaped structural types (`Env` in `src/loader/env.ts`), not the DOM lib. `src/browser.ts` is `install(globalThis)`. `tsconfig` keeps `lib: ["ES2020"]`, so a stray DOM use anywhere still fails to compile.
- **Why**: constitution V (everything injected); tests use plain objects; the loader never needs more than `document.currentScript.getAttribute(name)`.
- **Alternatives**: add `DOM` to `lib` (weakens the 001 guard); a separate tsconfig for the loader (more config for little gain).

### D4. Finding the script tag

- **Decision**: read `document.currentScript` synchronously at the top of `install`, before anything is awaited. Not found (null, or no `getAttribute`) is the same as both attributes missing.
- **Why**: it is the only way that survives `async`, a renamed file and a proxy (spec edge case); it works only during the first synchronous run, which is why `install` captures it first. It is how `ad-serve-client` does it (read only: `src/index.ts`).
- **Alternatives**: search for `script[src*="content-sdk"]` (breaks on a renamed or proxied file).

### D5. The stub, the queue and the methods

- **Decision**: reuse `env.contentSdk` if it is an object, else create `{ q: [] }` and assign it (also when `q` is not an array: replace with a new array). Replay is an index loop over `q` so a command pushed during replay also runs, in order. Afterwards `q.push` is replaced by a function that runs each pushed entry at once and returns the new length (spec Assumptions: the queue keeps working after load). Methods are assigned onto the same object: `contentSdk.fetchPage`.
- **Double load**: if `typeof contentSdk.fetchPage === "function"` the second load logs one warning and returns before touching `q` or the methods (FR-017).
- **Missing attributes**: one warning, return. If the page made a stub it keeps it, with `q` untouched and no methods; if there was none, none is created, so the page is unchanged (FR-003). The stub is created only once the settings are valid.

### D6. Command table and arguments

- **Decision**: `commands = { fetchPage }` (own-property check, so `constructor` or `__proto__` is never a command). A queue entry must be a non-empty array whose first item is a string in the table; otherwise one warning (`Unknown command: <name clipped to 40 characters>`, or `Bad queue entry` when there is no usable name). Arguments are passed as given; the 001 client already refuses bad ones with a typed result.
- **Why**: FR-010, FR-011, constitution II (the name is untrusted text).

### D7. `fetchPage` and the callback

- **Decision**: `fetchPage(placementId, query, callback)` calls the 001 `fetchPage({ baseUrl, platformId, placementId }, query)` and returns that promise's result after the callback ran. The callback gets the 001 `Result` unchanged. A callback that is not a function is ignored. A throw, or a returned promise that rejects, is caught and gives one warning `[content-sdk] A fetchPage callback threw: <clipped message>` and does not affect the returned promise. The returned promise never rejects (the 001 function never rejects; the loader still wraps the whole call in a catch that turns anything unexpected into a `network` error, as a last guard).
- **Order**: commands start in the order queued. Callbacks fire as each answer arrives, so completion order is the network's. With the immediate fakes in tests the order is also the queue order.
- **Not exposed**: `signal` and `fetch` (spec Assumptions).

### D8. Warning texts

- **Decision**: all start with `[content-sdk] `. Missing attributes: `[content-sdk] Missing <attr list> on the content-sdk <script> tag: add <attr>="..." (one per missing attribute). Nothing will be fetched.` Texts are fixed except the clipped command or error message. `warn` never throws and never logs an object.
- **Why**: `ad-serve-client` does the same; a fixed text is greppable and documented in the contract.

### D9. Build and package

- **Decision**: `scripts/build.mjs` builds `src/index.ts` to ESM and CJS as before, and `src/browser.ts` to `dist/content-sdk.js` (IIFE, minified, `sourcemap: true`, no `globalName`, `target: es2020`). `package.json`: `exports["./browser"]`, `files: ["dist", "README.md"]`, `scripts.prepare: "npm run build"`, `version: "0.2.0"`, still `private`. A jest `globalSetup` runs the build once so the jsdom test reads the real file.
- **Why prepare and files**: npm runs `prepare` after a git install (dev dependencies are installed first for that), and `files` makes sure the gitignored `dist/` is in what npm copies. Checked in the quickstart with `npm pack` and a temporary install from a local git URL.
- **Version**: the bump to 0.2.0 is in this feature so the tag matches; creating the tag or publishing is the owner's call.

### D10. Tests

- **Decision**: unit tests with a fake `Env` (script stub with `getAttribute`, a recording console, a plain `contentSdk` object) and a fake 001 `fetchPage` injected into `commands.ts`; the jsdom test (`tests/browser/`) puts a `<script>` with the built file's text and the two attributes in the page after setting `window.fetch` to a fake, and waits for the callback. Jest's jsdom environment runs scripts, so `document.currentScript` is set as in a browser. The node project ignores `tests/browser`. The 001 headless scan skips `src/loader/` and `src/browser.ts`, and a second, narrower scan on those forbids `createElement`, `innerHTML`, `appendChild`, `insertAdjacent`, `document.write`, `cookie`, `localStorage`, `sessionStorage`, `eval` and `Function` (FR-012, FR-013).

## Reversals

- `q.push` after load: the plan said it returns "the new length"; because the queue is emptied after replay and a push is run, not kept, it returns 0 (a number, as `Array.push` does). The contract only promises that the command runs.

## Verification (2026-11-16)

- `npm run lint`, `npm run typecheck`, `npm test`: 34 suites, 517 tests pass in both Jest projects (node, jsdom); the jsdom `tests/browser` test loads the real built `dist/content-sdk.js`.
- Quickstart step 2: the built file adds no global but `contentSdk` (and none at all when the attributes are bad). Step 3: `require.resolve("content-sdk/browser")` gives `dist/content-sdk.js`; `require` and `import` of the bare name give `fetchPage`.
- Install from a repository (step 4): a scratch git repository holding the tracked sources (no `dist/`) tagged and installed with `npm install git+file://…#tag`; `prepare` ran, `dist/` holds the built files including `content-sdk.js` and its map, the path resolves, and the library `require` and `import` work. `npm pack --dry-run` lists `dist/content-sdk.js` and `.map`. The real repository was not committed for this test.
- **For content-api's side**: npm printed an `allow-scripts` notice that the package's `prepare` script is "not yet covered by allowScripts". The script still ran here, but a consumer that enforces that policy must allow `content-sdk`'s `prepare`, or the git install gives no `dist/`.
- Not done by me: quickstart step 5 (a page on the allowed origin against the hosted service; SC-007).

## Gap check (T038)

FR-001 to FR-020 and SC-002 to SC-006 have code and tests. SC-001 (10 minutes) is a human outcome. Known limits: callbacks fire as answers arrive, so completion order is the network's (start order is the queue's); the loader does not expose `signal` or `fetch`; `dist/` also holds declarations for the loader (`browser.d.ts`, `loader/`), which are harmless.
