# Tasks: Browser Bundle and Loader

**Input**: Design documents from `/specs/002-browser-loader/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/loader.md](contracts/loader.md), [quickstart.md](quickstart.md)

**Tests**: Included (constitution V; spec FR-020). Each test task comes before the code it checks and must fail first.

**Organization**: By user story. US1 builds the minimal loader end to end; US2 to US4 extend it, so they run in order. Each ends with a green lint, typecheck and test run.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 embed and fetch, US2 queue replay, US3 misconfiguration, US4 install and file path
- Paths are from the repository root. Nothing is tagged, pushed, merged or published without the owner's go-ahead (CLAUDE.md).

## Phase 1: Setup

**Purpose**: Build and test plumbing the loader needs (research D9, D10). The 001 tests must keep passing.

- [X] T001 Edit `scripts/build.mjs`: keep the ESM and CJS builds of `src/index.ts`; build `src/browser.ts` to `dist/content-sdk.js` as a minified IIFE with `sourcemap: true`, no `globalName`, `target: "es2020"`; keep the `tsc` declaration step
- [X] T002 [P] Create `tests/setup/build.ts` (a Jest `globalSetup` that runs `node scripts/build.mjs` once and fails the run if the build fails) and register it in `jest.config.ts`; also in `jest.config.ts` change the `node` project to ignore `tests/browser/` and the `jsdom` project to also match `tests/browser/**/*.test.ts` (keep ignoring `headless.test.ts`)
- [X] T003 [P] Create the folders `src/loader/`, `tests/unit/loader/` and `tests/browser/` (git keeps them once T004, T005 and T011 add files)

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: The injected environment, the safe warning and the attribute reader that every story uses.

- [X] T004 Create `src/loader/env.ts` with the small structural types the loader needs and nothing else: `ScriptLike { getAttribute(name: string): string | null }`, `Env { document?: { currentScript?: ScriptLike | null }; console?: { warn?(...args: unknown[]): void }; contentSdk?: unknown }` and the `SdkGlobal` shape from [data-model.md](data-model.md) (no DOM lib types)
- [X] T005 [P] Write `tests/unit/loader/warn.test.ts`: `warn` calls `console.warn` once with one string argument; clips long text to the given limit; does nothing and does not throw when `console` or `console.warn` is missing, or when `console.warn` itself throws; never logs an object
- [X] T006 Create `src/loader/warn.ts` with `warn(env, text)` and `clip(text, max)` (never throws); make T005 pass
- [X] T007 [P] Write `tests/unit/loader/settings.test.ts`: both attributes present gives `{ baseUrl, platformId }` trimmed; each of missing (`null`), empty, and whitespace-only is reported by name; both bad gives both names in the order `data-api-base-url`, `data-platform-id`; no script tag (`null` or `undefined`) reports both; a script whose `getAttribute` throws reports both and does not throw
- [X] T008 Create `src/loader/settings.ts` with `readSettings(script)` returning `{ settings }` or `{ missing: string[] }`; make T007 pass

**Checkpoint**: foundational units pass; `npm run typecheck` is clean.

---

## Phase 3: User Story 1 - Embed and fetch a page (Priority: P1) MVP

**Goal**: With the stub and the script tag, `fetchPage(placementId, query, callback)` gives the callback and the returned promise the delivery client's result.

**Independent Test**: In a jsdom page with the stub, the two attributes and a fake `fetch`, the built file answers `window.contentSdk.fetchPage("latest", { limit: 5 }, cb)` with the page from the fake.

### Tests for User Story 1

- [X] T009 [P] [US1] Write `tests/unit/loader/commands.test.ts` for `makeFetchPage(settings, deps)` with an injected fake delivery `fetchPage`: it is called with `{ baseUrl, platformId, placementId }` and the query as given; the callback gets the result unchanged and the returned promise resolves with the same object; query options `limit`, `tags`, `languages`, `cursor` pass through untouched; a failure result goes to the callback as is; no callback still resolves; a non-function callback is ignored
- [X] T010 [P] [US1] Write `tests/unit/loader/install.test.ts` for the success path with a fake `Env`: with both attributes, `env.contentSdk` is created as `{ q: [] }` plus a `fetchPage` method when absent, and reused when present (same object, `q` kept); `fetchPage` is the only member added besides `q`
- [X] T011 [P] [US1] Write `tests/browser/bundle.test.ts` (runs in jsdom): read `dist/content-sdk.js`; set `window.fetch` to a fake answering the 001 example body; put a `<script>` carrying the file's text and the two attributes into the page after the stub; call `window.contentSdk.fetchPage("latest", { limit: 5 }, cb)` and `await` its promise; expect `cb` and the promise to give `{ ok: true, page }` and the fake to have seen `…/api/v1/delivery/listings/latest?limit=5`; also check the built file has no newline inside its code, ends with exactly one `//# sourceMappingURL=content-sdk.js.map` comment line, that `dist/content-sdk.js.map` exists, and that `Object.keys(window)` gained only `contentSdk`

### Implementation for User Story 1

- [X] T012 [US1] Create `src/loader/commands.ts` with `makeFetchPage(settings, deps)` (deps holds the delivery `fetchPage` and the env for warnings) following research D7: call the 001 function, run the callback after the result with its throw and rejection caught (one warning each), return the result; wrap the whole call so the promise never rejects (last guard returns a `network` error); make T009 pass
- [X] T013 [US1] Create `src/loader/install.ts` with `install(env)` for the success path: capture `env.document.currentScript` first, read settings, create or reuse `env.contentSdk`, assign `fetchPage`; make T010 pass
- [X] T014 [US1] Create `src/browser.ts` that imports `install` and calls `install(globalThis)`, and nothing else; run `npm run build`; make T011 pass
- [X] T015 [US1] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: a page with the stub and tag can fetch; MVP.

---

## Phase 4: User Story 2 - Call before the script has loaded (Priority: P1)

**Goal**: Commands queued before load run once each in the order pushed; the queue keeps working after load; bad entries are warned about, not fatal.

**Independent Test**: Push 20 commands, load the built file, confirm 20 callbacks with the right results in queue order, one warning per bad entry, and the later `push` and the method both work.

### Tests for User Story 2

- [X] T016 [P] [US2] Add to `tests/unit/loader/install.test.ts` with a fake delivery `fetchPage` that resolves immediately in call order: 20 queued `fetchPage` entries start in order and each runs exactly once; a command pushed from inside a callback during replay also runs, after the earlier ones; after load `q.push(entry)` runs the entry at once and returns the new length; a callback that throws does not stop later queued commands and gives one warning each; replay starts only after the attributes are read
- [X] T017 [P] [US2] Add to `tests/unit/loader/install.test.ts` the bad entries: `"x"`, `null`, `5`, `[]`, `[5]`, `["nope"]`, `["constructor"]`, `["__proto__"]`, `["toString"]` each give one warning (`Bad queue entry` for non-arrays, empty arrays and non-text names, `Unknown command: <name>` otherwise, name clipped to 40 characters) and the good entries around them still run; a 200-character command name is clipped in the warning
- [X] T018 [P] [US2] Add to `tests/unit/loader/install.test.ts`: no stub (`env.contentSdk` undefined) works; `q` that is not an array is replaced by an array; a second `install` on the same object logs `The script was loaded twice; the second load was ignored.` once, does not replay `q` again and does not replace `fetchPage`
- [X] T019 [P] [US2] Add to `tests/browser/bundle.test.ts`: queue three commands before inserting the script; after it loads the callbacks fire with the three results in queue order (fake `fetch` resolves in call order); inserting the same file a second time warns once and leaves the first load's `fetchPage` in place

### Implementation for User Story 2

- [X] T020 [US2] Extend `src/loader/commands.ts` with the command table (own-property check, so `constructor` and `__proto__` are never commands) and `run(entry)`; make bad entries and unknown names warn per research D6
- [X] T021 [US2] Extend `src/loader/install.ts` per research D5: ensure `q` is an array, replay it with an index loop, then replace `q.push` with a function that runs each entry and returns the new length; add the double-load check (`typeof fetchPage === "function"` means loaded) before touching `q`; make T016 to T019 pass
- [X] T022 [US2] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: stories 1 and 2 work; SC-002 is covered.

---

## Phase 5: User Story 3 - Misconfiguration is visible and harmless (Priority: P2)

**Goal**: A missing or blank attribute gives one warning and nothing else; nothing ever throws into the page.

**Independent Test**: Load with each attribute missing, empty and blank: one warning per load naming the attribute, no `fetchPage` method, queued commands not run, no throw.

### Tests for User Story 3

- [X] T023 [P] [US3] Add to `tests/unit/loader/install.test.ts`: for each of `data-api-base-url` missing, `data-platform-id` missing, each blank, each whitespace-only, and both missing: exactly one warning with the fixed text from [contracts/loader.md](contracts/loader.md) naming the right attribute(s); `env.contentSdk` has no `fetchPage`, and when there was no stub it stays undefined (nothing is created on the page); queued entries are not run and `q` is untouched; `install` does not throw; no script tag found gives the both-missing warning
- [X] T024 [P] [US3] Add to `tests/unit/loader/install.test.ts`: a base address that is present but unusable (`"not a url"`, `"ftp://x"`) is accepted at load, and a call gives the 001 `invalid_target` result to the callback; a non-string `placementId`, a `query` of the wrong type and an `env` with no `console` never throw
- [X] T025 [P] [US3] Create `tests/unit/loader/no-throw.test.ts`: at least 20 bad inputs in one table (missing or blank attributes, no script tag, bad queue entries, unknown commands, throwing and rejecting callbacks, non-function callbacks, bad arguments, a failing and a throwing network function, a throwing `console.warn`); every case ends with no exception out of `install` or `fetchPage`, no rejected promise, and the expected warning count (SC-003)
- [X] T026 [P] [US3] Add to `tests/browser/bundle.test.ts`: the built file loaded without `data-platform-id` logs one warning naming it, makes no request (the fake `fetch` is not called) and adds no `fetchPage`; the same for a blank `data-api-base-url`

### Implementation for User Story 3

- [X] T027 [US3] Extend `src/loader/install.ts`: on missing settings log the one warning (fixed text, names from `readSettings`) and return before creating the stub, touching `q` or adding methods; guard every step so nothing throws (a try/catch around the whole `install` body that logs one generic warning is allowed as a last guard); make T023 to T026 pass
- [X] T028 [US3] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: stories 1 to 3 work; SC-003 is covered.

---

## Phase 6: User Story 4 - Install from the repository and find the file (Priority: P2)

**Goal**: An install from the repository at a tag gives a built package, the documented path resolves to the browser file, and the 001 entries are unchanged.

**Independent Test**: In a scratch project, `npm install git+file://…#<ref>` runs the build, `require.resolve("content-sdk/browser")` gives the file, `import` and `require` of the bare name still give `fetchPage`.

### Tests for User Story 4

- [X] T029 [P] [US4] Write `tests/unit/package.test.ts`: `package.json` has `exports["./browser"]` equal to `./dist/content-sdk.js`, keeps the `.` entry's `types`, `import` and `require` targets from 001, has `files` including `dist`, has a `prepare` script that runs the build, has no `dependencies`, is `private`, and has version `0.2.0`; each file named by `exports` exists after the build (the Jest build step runs first)
- [X] T030 [P] [US4] Write `tests/unit/entries.test.ts`: `require("../../dist/index.cjs")` and the ESM file (via dynamic `import()` in a child `node` process) both expose `fetchPage` as a function and no `contentSdk` global is created by loading them; `dist/index.d.ts` still exports the 001 types

### Implementation for User Story 4

- [X] T031 [US4] Edit `package.json`: add `exports["./browser"]`, `files: ["dist", "README.md"]`, `scripts.prepare: "npm run build"`, version `0.2.0`; keep `private: true`; make T029 and T030 pass
- [X] T032 [US4] Verify an install from the repository as in [quickstart.md](quickstart.md) step 4: `npm pack --dry-run` lists `dist/content-sdk.js` and `dist/content-sdk.js.map`; in a scratch directory under the scratchpad, `npm install` from a local git URL of this branch, then `require.resolve("content-sdk/browser")` gives the file and the bare import works; record the result in `research.md` under "Verification"; if `dist/` is missing, fix `files` or `.gitignore` handling and record the reversal
- [X] T033 [US4] Run `npm run lint && npm run typecheck && npm test`; fix anything red

**Checkpoint**: all four stories work; SC-004 to SC-006 are covered.

---

## Phase 7: Polish and cross-cutting

- [X] T034 Update `tests/unit/headless.test.ts`: make the 001 scan recursive over `src/` (today it reads only the top level, so `src/loader/` is not scanned at all) and exempt only `src/loader/` and `src/browser.ts` from it; add a second scan over those files forbidding the words `createElement`, `innerHTML`, `appendChild`, `insertAdjacent`, `cookie`, `localStorage`, `sessionStorage`, `eval`, `Function`, and the text `document.write` (comments removed), and allowing `document` only as `env.document` or `currentScript` reads (FR-012, FR-013)
- [X] T035 [P] Write the "Embedding" section of `README.md` per FR-018: the stub, the script tag, what each attribute is, the exact missing-attribute warning, `fetchPage` before and after load, the `content-sdk/browser` path and the install from the repository; update the existing "Build and test" section for the new build outputs and the removed `ContentSdk` global
- [X] T036 [P] Update `specs/001-delivery-client/quickstart.md` step 4 to the new snippet from [quickstart.md](quickstart.md) step 5 (the `ContentSdk` global is gone) and note the change in `specs/001-delivery-client/research.md` under "Reversals"
- [X] T037 Walk [quickstart.md](quickstart.md) steps 1 to 4 and record the results in `research.md` under "Verification"; step 5 (a page on the allowed origin against the hosted service) is left to the owner (SC-007)
- [X] T038 Check FR-001 to FR-020 and SC-001 to SC-006 against the code and tests, list any gap in `research.md`; `/speckit-converge` runs this again
- [X] T039 Update the status line in `CLAUDE.md` (remote now exists: `github.com/tutushtutush/content-sdk`, first feature merged, second in progress); no other change to it

---

## Dependencies and order

- Phase 1 then Phase 2, then stories US1, US2, US3, US4 in order, then Phase 7.
- US2 and US3 edit `src/loader/install.ts` and `src/loader/commands.ts`, so they are not run in parallel with each other. US4 touches only `package.json` and package tests, so T029 and T030 can be written while US3 is under way, but T031 waits for US3 to finish so the suite is green.
- Within a phase, `[P]` tasks touch different files or add independent cases. Tasks that add to the same test file (T010, T016 to T018, T023 and T024) are sequenced by phase.
- Each test task comes before its implementation task and must fail first.

## Parallel examples

- Phase 1: T002 and T003 after T001.
- Phase 2: T005 and T007 together, then T006 and T008.
- US1 tests: T009, T010, T011 together, then T012, T013, T014 in order.
- US2 tests: T016 to T019 together, then T020, T021.
- US3 tests: T023 to T026 together, then T027.
- Polish: T035 and T036 together.

## Implementation strategy

- **MVP**: Phases 1 and 2 and US1 (T001 to T015). A platform can already embed the script and fetch a page.
- Then US2 (the async case, which is the normal one with an `async` tag), US3 (misconfiguration) and US4 (install and path) in turn; each ends green.
- The version `0.2.0` is bumped here, but the tag and any publish are the owner's call; the PR is merged only on "merge".

## Phase 8: Convergence

- [X] T040 Add the two remaining warning texts (`[content-sdk] Command <name> failed: <message>` and `[content-sdk] The loader failed to start: <message>`) to the warnings tables in `contracts/loader.md` and `data-model.md`, and add a test in `tests/unit/loader/install.test.ts` that triggers each (a command that throws synchronously; an `env` whose property access throws) and checks the exact text and that nothing is thrown, per FR-019 (partial)
- [X] T041 Limit the declaration build in `tsconfig.build.json` to the library entry (`src/index.ts` and what it imports) so `dist/` no longer holds `browser.d.ts` and `loader/*.d.ts`, and add a check to `tests/unit/entries.test.ts` that they are absent; or, if you want them shipped, record that in `research.md` instead, per plan D9 (unrequested)
