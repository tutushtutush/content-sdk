# Tasks: Delivery Client

**Input**: Design documents from `/specs/001-delivery-client/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/public-api.md](contracts/public-api.md), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution (principle V) requires unit tests with fakes, and spec FR-019 requires contract tests. Tests are written before the code they check and must fail first.

**Organization**: Grouped by user story. Stories 2 to 4 extend the code from story 1, so they run in order P1, P2, P3, P4; each can still be tested on its own with a fake `fetch`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 fetch a page, US2 follow the cursor, US3 typed errors, US4 untrusted text
- Paths are from the repository root. Nothing is pushed, merged or published (CLAUDE.md).

## Phase 1: Setup

**Purpose**: Project skeleton, tool config and build, copied from `ad-serve-client` and adapted (plan: Project Structure, research D3, D11).

- [X] T001 Create `package.json` with name `content-sdk`, version `0.1.0`, `"private": true`, `"type": "commonjs"` (as `ad-serve-client`; the ESM and CJS outputs use `.mjs` and `.cjs` extensions), `engines.node >=22`, no `dependencies`, the same dev dependencies and versions as `/Users/tsega/Documents/Git/ad-serve-client/package.json` (including `jest-environment-jsdom`, used only for the browser-like test project), `exports` for `import` (`dist/index.mjs`), `require` (`dist/index.cjs`) and `types` (`dist/index.d.ts`), and scripts `build`, `test` (`jest --passWithNoTests` until the first tests exist), `lint`, `typecheck`
- [X] T002 [P] Create `tsconfig.json` (strict, target ES2020, `lib` ES2020 without `DOM` so DOM use fails to compile, `noEmit`, includes `src`, `tests`, `scripts`) and `tsconfig.build.json` (declarations only, `src` only, output `dist`)
- [X] T003 [P] Create `eslint.config.mjs` based on `ad-serve-client`'s, with Node globals (no browser globals)
- [X] T004 [P] Create `jest.config.ts` with two projects, both `preset: "ts-jest"`, `roots: ["<rootDir>/tests"]`, `clearMocks: true`: `node` (`testEnvironment: "node"`, all `**/*.test.ts` except `tests/live`, which runs only when `CONTENT_SDK_LIVE=1`) and `jsdom` (`testEnvironment: "jsdom"`, only `tests/unit` and `tests/contract`, excluding `headless.test.ts`)
- [X] T005 Create `scripts/build.mjs` that runs esbuild three times (ESM `dist/index.mjs`, CJS `dist/index.cjs`, minified IIFE `dist/content-sdk.js` with global name `ContentSdk`, target es2020, source maps) and then emits `dist/index.d.ts` with `tsc -p tsconfig.build.json`
- [X] T006 Run `npm install` (no commit) and confirm `npm run lint`, `npm run typecheck` and `npm test` run (`test` passes with no tests yet); add `dist/` and `coverage/` to `.gitignore` if missing

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: Types and error constructors every story uses.

- [X] T007 Create `src/types.ts` with `Target`, `Query`, `Options`, `Image`, `Item`, `Page`, `ErrorKind`, `DeliveryError`, `Result` exactly as in [data-model.md](data-model.md)
- [X] T008 [P] Write `tests/unit/errors.test.ts`: each constructor returns the right `kind`, a fixed SDK-written `message`, and only the fields it was given; `serviceMessage` and `cause` are kept as given
- [X] T009 Create `src/errors.ts` with one small constructor per kind (`unknownPlacement`, `originNotAllowed`, `badQuery`, `unavailable`, `network`, `contractMismatch`, `invalidTarget`) and `fail(error)` / `succeed(page)` helpers returning `Result`; make T008 pass
- [X] T010 Create `src/index.ts` that exports only the types for now (no placeholder `fetchPage`); `fetchPage` is added to it in T017

**Checkpoint**: types and errors compile; `npm run typecheck` passes.

---

## Phase 3: User Story 1 - Fetch a page of items (Priority: P1) MVP

**Goal**: Given base address, platform id and placement id, with optional limit, tags and languages, return a page of plain items and the next cursor.

**Independent Test**: With a fake `fetch` answering the contract's example body, `fetchPage` returns `{ ok: true }` with the nine-field items and `nextCursor`; the fake sees exactly the request the contract defines.

### Tests for User Story 1

- [X] T011 [P] [US1] Write `tests/unit/request.test.ts`: address is `<base>/api/v1/delivery/<platform>/<placement>`; base with and without trailing slash and with a path prefix give the same address; ids with `/ ? # space` are encoded and cannot change the path; only given options are sent; tags and languages are comma-joined; empty arrays are not sent; limit 1 and 50 pass
- [X] T012 [P] [US1] Write `tests/unit/validate.test.ts` for the happy path: the contract example body gives the expected `Page`; an empty page `{"items": [], "next_cursor": null}` is valid; an item with `url: null` and an item with `images: []` are valid; a string `next_cursor` is kept
- [X] T013 [P] [US1] Write `tests/contract/delivery-v1.test.ts` for the success cases: the 200 example from `delivery-v1.md` and the empty page, each run through `fetchPage` with a fake `fetch`; keep the example bodies in `tests/contract/fixtures/delivery-v1.ts` with a comment naming the contract file they come from
- [X] T014 [P] [US1] Write `tests/unit/fetch-page.test.ts` success cases: the request has method GET, `credentials: "omit"`, no headers, and the caller's `signal`; the injected `fetch` is the one called; with no injected `fetch` the global one is used (stub `globalThis.fetch`)

### Implementation for User Story 1

- [X] T015 [US1] Create `src/request.ts`: `buildRequestUrl(target, query)` implementing D6 and D7, returning either `{ url }` or `{ error }` with the typed `invalid_target` or `bad_query` error from `src/errors.ts` (limit whole number 1 to 50, tag and language rules; the cursor rules come in T021), so no rework is needed in US3; make T011 pass
- [X] T016 [US1] Create `src/validate.ts`: `parsePage(body)` per D8, building the `Page` and every `Item` and `Image` field by field and dropping unknown fields; return a page or a mismatch description; make T012 pass
- [X] T017 [US1] Create `src/fetch-page.ts` with `fetchPage(target, query?, options?)`: build address, call `options.fetch ?? globalThis.fetch` with `{ method: "GET", credentials: "omit", signal }`, read JSON, call `parsePage`, return `succeed`; export it from `src/index.ts`; make T013 and T014 pass
- [X] T018 [US1] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: story 1 works alone: a platform can show a first page.

---

## Phase 4: User Story 2 - Follow the cursor (Priority: P2)

**Goal**: Pass `nextCursor` back as `query.cursor` and get the next page, until the cursor is null.

**Independent Test**: A fake serving three pages in order; walking the loop from [contracts/public-api.md](contracts/public-api.md) yields every item once, in order, and ends on a null cursor.

- [X] T019 [P] [US2] Add tests to `tests/unit/request.test.ts`: `cursor` is sent unchanged (including characters that need encoding); empty or absent cursor is not sent; a 512-character cursor passes
- [X] T020 [P] [US2] Write `tests/unit/paging.test.ts`: three fake pages, the loop from `contracts/public-api.md` visits all items once in order, each request carries the previous `nextCursor` and the same filters, and the last page has `nextCursor: null` (SC-005)
- [X] T021 [US2] Add cursor handling to `src/request.ts` (send unchanged, skip empty); make T019 and T020 pass

**Checkpoint**: stories 1 and 2 work.

---

## Phase 5: User Story 3 - Typed, readable errors (Priority: P2)

**Goal**: Every failure is a returned typed error; nothing throws or rejects.

**Independent Test**: A fake `fetch` for each failure (404, 403, 422, 500, 503, 3xx status, rejected fetch, aborted signal, bad JSON, wrong shape) gives its own kind and the call never rejects.

### Tests for User Story 3

- [X] T022 [P] [US3] Add to `tests/unit/request.test.ts`: limit 0, 51, 1.5, `NaN`, a string; more than 50 tags or languages; a tag with an uppercase letter, a space or a comma; a language with a comma or 17 characters; a 513-character cursor; each is `bad_query` with `fields` naming `limit`, `tag`, `language` or `cursor`, and the fake `fetch` is never called; also empty `baseUrl`, a `baseUrl` that is not `http` or `https`, an empty `platformId` or `placementId` give `invalid_target` with `fields` naming the input
- [X] T023 [P] [US3] Write `tests/contract/errors.test.ts` from `delivery-v1.md`: 404 `unknown_placement`, 403 `origin_not_allowed`, 422 `invalid` with `details` naming `limit`, 503 `unavailable`; each gives the matching kind, `status`, and for 422 the `fields` and `serviceMessage`; use the real 422 body shape `{ "error": { "code": "invalid", "message": …, "details": { "fields": [{ "field": "limit", "message": … }] } } }` (research D9), plus cases with `details` missing, empty, or of the wrong type, which leave `fields` undefined
- [X] T024 [P] [US3] Add to `tests/unit/fetch-page.test.ts`: statuses 400, 500, 502, 301, 304 give `unavailable` with the status; `fetch` rejects with an `Error`, with a string and with `undefined` gives `network` with `cause`; a signal aborted before and during the call gives `network` with `aborted: true`; a non-JSON body on 200 gives `contract_mismatch`; an error response with an HTML body or a body that is not the error shape still gives the status's kind; a body read that rejects gives `network`; `fetchPage` never rejects in any of these
- [X] T025 [P] [US3] Add to `tests/unit/validate.test.ts` the mismatch cases: body is `null`, an array, a string; `items` missing, not an array, or an item that is `null`; each of the nine item fields missing and each with a wrong type; `tags` with a non-string; `images` with a non-object; `next_cursor` missing, a number, or `undefined`; one bad item among good ones fails the whole page
- [X] T026 [P] [US3] Write `tests/unit/no-throw.test.ts`: at least 20 broken outcomes in one table (SC-003), including odd inputs such as `undefined` target, `query` with wrong types and a `fetch` that throws synchronously; every case resolves to `{ ok: false }` with a known `kind` and none rejects

### Implementation for User Story 3

- [X] T027 [US3] In `src/request.ts` and `src/fetch-page.ts` guard against a non-object `target`, `query` or `options` and non-string field values (returning `invalid_target` or `bad_query`), and confirm every refusal carries `fields`; make T022 pass
- [X] T028 [US3] In `src/fetch-page.ts` map statuses per the table in [data-model.md](data-model.md), wrap only the `fetch` call and the body read in try/catch (set `aborted` from `signal.aborted`), read `error.details` tolerantly for `fields` and `error.message` for `serviceMessage` on 422 and other error bodies, and return `contractMismatch` for unparseable or invalid 200 bodies; make T023, T024, T025 and T026 pass
- [X] T029 [US3] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: stories 1 to 3 work; SC-003 is covered.

---

## Phase 6: User Story 4 - Safe with untrusted text (Priority: P2)

**Goal**: Returned data is plain, unchanged text, with address rules enforced and nothing built or evaluated.

**Independent Test**: Items with markup, script text, control characters, very long strings and wrong-type values: valid-shaped text comes back unchanged; wrong shapes are `contract_mismatch`.

- [X] T030 [P] [US4] Add to `tests/unit/validate.test.ts`: titles and descriptions with `<script>`, `<img onerror=…>`, control characters and a 1 MB string come back byte-for-byte equal; an item `url` with `"`, `<`, `>`, a backtick and `\` comes back unchanged (from `item-url.md`); `url` and image `url` with `javascript:`, `data:`, `ftp:`, `//host/x`, a relative path, or an empty string give `contract_mismatch`; `HTTP://` and `Https://` pass; image `url: null` gives `contract_mismatch`
- [X] T031 [P] [US4] Add to `tests/contract/delivery-v1.test.ts` the unknown-field cases from `contracts/public-api.md`: extra fields at the top level, on an item and on an image are absent from the result (compare with `toStrictEqual`), and the result objects have no `__proto__`, `constructor` or other inherited surprises when the body has keys named `__proto__` or `constructor`
- [X] T032 [P] [US4] Write `tests/contract/item-url.test.ts` for the cases from `item-url.md`: `url: null`, an `https` `url`, an address with odd characters
- [X] T033 [P] [US4] Write `tests/unit/headless.test.ts`: `fetchPage` runs with no `window`, `document` or `location` defined (Jest Node environment), and a scan of `src/**/*.ts` with comments removed finds none of the whole words `document`, `window`, `innerHTML`, `eval`, `Function` (SC-006)
- [X] T034 [US4] In `src/validate.ts` add the `http`/`https` form check (case-insensitive prefix, per D8) for item `url` and image `url`, and make sure the returned objects are built with explicit fields so keys such as `__proto__` in the body cannot reach the result; make T030 to T033 pass
- [X] T035 [US4] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: all four stories work.

---

## Phase 7: Polish and cross-cutting

- [X] T036 [P] Write `tests/live/live.test.ts`, skipped unless `CONTENT_SDK_LIVE=1`: `https://content-api-test.onrender.com`, platform `listings`, placement `latest` returns `ok` with valid items; a made-up placement is `unknown_placement`; set a long test timeout for the wake-up of the hosted service. Also check that every image address returned by the hosted service passes the `http` or `https` rule (research D12). Only use public values; no secrets (SC-007)
- [X] T037 Run `npm run build`; verify the four files in `dist/`; run the two `node -e` load checks and the dependency grep from [quickstart.md](quickstart.md) step 2; check `package.json` has no `dependencies`
- [X] T038 [P] Write `README.md`: what the SDK is, one install-free usage example (the paging loop), the error kinds table, the build outputs, and a link to [contracts/public-api.md](specs/001-delivery-client/contracts/public-api.md); no claims about npm publishing
- [X] T039 Walk [quickstart.md](quickstart.md) steps 1 to 3 and 5 and record the results in `specs/001-delivery-client/research.md` under "Reversals" or a new "Verification" heading, with anything started and then reversed; step 4 (browser from the allowed origin) is left to the owner
- [X] T040 Check the spec's FR-001 to FR-019 and SC-001 to SC-007 against the code and tests, and list any gap in `research.md`; this is done again by `/speckit-converge`
- [X] T041 Run `npm test` and confirm both Jest projects (`node` and `jsdom`) run the unit and contract tests and pass (SC-002)

---

## Dependencies and order

- Phase 1 then Phase 2, then stories in order US1, US2, US3, US4, then Phase 7.
- US2, US3 and US4 edit the files US1 creates (`src/request.ts`, `src/validate.ts`, `src/fetch-page.ts`), so they are not run in parallel with each other.
- Within a phase, `[P]` tasks touch different files, or only add independent test cases, and can run together. Tasks that add to the same test file (T011, T019, T022) are sequenced by phase, not parallel across phases.
- Each test task comes before its implementation task and must fail first.

## Parallel examples

- Phase 1: T002, T003, T004 together after T001.
- US1 tests: T011, T012, T013, T014 together, then T015, T016, T017 in order.
- US3 tests: T022 to T026 together, then T027, T028.
- US4 tests: T030 to T033 together, then T034.

## Implementation strategy

- **MVP**: Phases 1 and 2 and US1 (T001 to T018). A platform can already show a list.
- Then US2 (paging), US3 (errors) and US4 (untrusted text) in turn; each ends with a green lint, typecheck and test run.
- The package is not released until US3 and US4 are done, because they are the safety requirements (constitution II).
- Stop for the owner's review after each checkpoint; nothing is committed, pushed or published without the owner's go-ahead.

## Phase 8: Convergence

- [X] T042 Add a test in `tests/unit/fetch-page.test.ts` that passes deep-frozen `target`, `query` (with frozen `tags` and `languages` arrays) and `options`, and confirms the call succeeds and the inputs are unchanged, per contracts/public-api.md guarantee 7 (partial)
- [X] T043 Add `target` to the problem fields of `invalid_target` in `data-model.md` (used when the target is not an object), per data-model.md DeliveryError (partial)
- [X] T044 Document in `data-model.md` and `contracts/public-api.md` that platform and placement ids `.` and `..` are refused as `invalid_target` and that `serviceMessage` is cut to 500 characters, as already built in `src/request.ts` and `src/fetch-page.ts` (unrequested)
