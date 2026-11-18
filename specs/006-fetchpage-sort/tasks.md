# Tasks: Sort Option

**Input**: Design documents from `/specs/006-fetchpage-sort/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R9), [data-model.md](data-model.md), [contracts/query-sort.md](contracts/query-sort.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail.

**Rules for every task**: no runtime dependency, no new error kind, no new result field, no new module, no exported type or constant (research R5); a call without `sort` builds the byte-identical address (FR-003, SC-002) and the SDK adds no default; nothing throws or rejects into the page (FR-009); the content-api contract files are read only. Nothing is tagged, pushed, merged or published by these tasks; the owner does that.

**Build notes (2026-11-18)**: baseline (T001) 54 suites and 1678 tests; at the end 58 suites and 1818 tests, with typecheck, lint and build clean. Where the build differs from the text below: the fetch-level, paging and refusal tests (T005, T009, T011, and the throwing-`toString` case of T010) are in a new file, `tests/unit/sort.test.ts`, not added to `fetch-page.test.ts` and `paging.test.ts`; `tests/unit/loader/no-throw.test.ts` was not changed (T013) because it replaces the delivery client with a mock, so a bad `sort` cannot be exercised there, and the real client is exercised in `tests/browser/bundle.test.ts` and `tests/unit/no-throw.test.ts`; the spec, data model, contract, quickstart and these tasks were corrected where they said items include the service's `view_count`, which this SDK does not return (research R10); a query object with a throwing getter rejects `fetchPage` today for every field and was left as it is (research R11). `dist/` is ignored by git, so nothing from the build is committed.

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done. **[P]** can run in parallel (different files, no dependency on an open task). Stories: US1 a home page asks for the popular items, US2 a bad sort is a typed error, US3 paging keeps the order, US4 sort from a script tag.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `006-fetchpage-sort`, cut from an up-to-date `main`, and that `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass before any change; note the number of tests

---

## Phase 2: Foundational

**Goal**: the type and the one check that every story uses.

- [X] T002 [P] Write the tests first in `tests/unit/request.test.ts` (new `describe("sort")`): absent and `undefined` send no `sort`; `"popular"`, `"newest"` and `"oldest"` give `?sort=<value>`; with `limit`, `tags`, `languages`, `q` and `cursor` all given the address is `?limit=..&tag=..&language=..&q=..&sort=..&cursor=..` in that order; a call with every other field and no `sort` builds the same address as before (compare with the address of an existing test); each of `"best"`, `"Popular"`, `"NEWEST"`, `" popular"`, `"popular "`, `""`, `"views"`, `5`, `true`, `null`, `["popular"]`, `{}` and a symbol returns `bad_query` with `fields` `["sort"]` and no URL (at least ten values, SC-003); a bad `sort` together with a bad `limit` returns `fields` `["limit"]` (the builder checks `limit` first and stops at the first problem, as for the other fields), and a bad `sort` with a bad `cursor` returns `["sort"]` (sort is checked before the cursor)
- [X] T003 Add `sort?: "popular" | "newest" | "oldest"` to `Query` in `src/types.ts` with a doc comment: none keeps the service's order (newest first, best match first with `q`); a cursor belongs to the order and the `q` that made it, so pass the same ones with it; with `q` and a `sort` only the matches come back, in that order; a `popular` list is ranked as of its first page, and a changing view count can repeat or skip an item between pages
- [X] T004 Implement `checkSort` in `src/request.ts` (T002): a module constant list of the three values (not exported); `undefined` returns nothing to send; a string equal to one of them returns it; anything else returns `badQuery({ fields: ["sort"] })`; call it after the search check and before the cursor, and set the `sort` parameter with the same `URLSearchParams` as the others. Make no other change to the file

**Checkpoint**: the request builder sends and refuses `sort` as specified; every existing test still passes unedited.

---

## Phase 3: User Story 1 - A home page asks for the popular items (Priority: P1)

**Goal**: `fetchPage` sends `sort` and returns the service's items as before.

**Independent Test**: a fake service receives `sort=popular`; the result holds the fake's items in its order, with the same fields as always and no score; without `sort` none is sent.

- [X] T005 [P] [US1] Add tests to `tests/unit/fetch-page.test.ts`: with `{ sort: "popular" }` the fake receives one request whose search is `?sort=popular`; `newest` and `oldest` the same; the result of a `popular` call is `{ ok: true, page }` with the fake's items in the fake's order, with the same nine fields as always and no other key (no score, and no `view_count`: the SDK does not return it, research R10); a call without `sort` sends no `sort` and the SDK has no default (the address has no `sort` for a query with only `limit`)
- [X] T006 [P] [US1] Write `tests/contract/delivery-sort.test.ts` (new, beside `search-v1.test.ts`), with a header that names the rules read from content-api `specs/020-delivery-sort/contracts/delivery-v1-delta.md` (read only): the three values are the only ones sent; the request carries `sort` and nothing the caller did not give; a `200` for a `popular` page is read as any page, in the service's order, items in `item-v1` form (no score); a `422 invalid` naming `sort` is `bad_query` naming `sort` with the service's message; a `422` naming `cursor` is `bad_query` naming `cursor`; no retry after either (one call made)
- [X] T007 [US1] Make T005 and T006 pass (they should already pass with T004; fix the code, not the tests, unless a test is wrong)

**Checkpoint**: a platform can ask for any of the three orders and gets the page as plain data.

---

## Phase 4: User Story 2 - A bad sort is a typed error, not a throw (Priority: P1)

**Goal**: every bad value resolves to `bad_query` naming `sort`, with no request and no throw.

**Independent Test**: each bad value resolves to `{ ok: false, error: { kind: "bad_query", fields: ["sort"] } }` and the fake is never called.

- [X] T008 [P] [US2] Add to `tests/unit/no-throw.test.ts`, in the style of the `q` cases already there: `fetchPage(target, { sort: 5 as never })`, `{}`, `["popular"]`, `null`, `true`, `""`, `"Popular"`, a symbol, and an object with a throwing `toString`; each resolves, never rejects
- [X] T009 [P] [US2] Add to `tests/unit/fetch-page.test.ts`: for the bad values of T002, the result is `{ ok: false, error }` with kind `bad_query`, `fields` `["sort"]` and no `status`, and the fake fetch was called zero times; a `sort` the service refuses with `422` (for example a newer service that changed its list is simulated by a fake that answers `422` naming `sort` for `"popular"`) is `bad_query` with the field the service named and `status` 422, with one call made
- [X] T010 [US2] Make T008 and T009 pass; if a value throws inside the check (a throwing `toString`, a `Proxy`), compare with `===` against the constants and never convert the value to text

**Checkpoint**: no value of `sort` can make the SDK throw or send an unchecked request.

---

## Phase 5: User Story 3 - Paging keeps the order (Priority: P2)

**Goal**: the cursor and `sort` pass through together, unchanged, and nothing is remembered.

**Independent Test**: a first page with `sort`, then a second with its cursor and the same `sort`, sends both as given.

- [X] T011 [P] [US3] Add to `tests/unit/paging.test.ts`: a first page with `{ sort: "popular", limit: 1 }` returns `nextCursor`; the second call with `{ sort: "popular", limit: 1, cursor }` sends `sort=popular` and the same `cursor` unchanged; a fake that answers `422` naming `cursor` when the cursor is used with `oldest` gives `bad_query` naming `cursor`, with one call made and no retry; a later call without `sort` sends no `sort` and no `cursor` (nothing remembered, FR-006); a `sort` with a `q` and a cursor sends all three
- [X] T012 [US3] Make T011 pass (it should already pass; the SDK must not compare the cursor with the `sort`, research R7)

**Checkpoint**: paging follows the order the caller asks for, and the service alone judges whether a cursor fits.

---

## Phase 6: User Story 4 - Sort from a script tag (Priority: P2)

**Goal**: the page-facing `fetchPage` accepts `sort`, queued or direct.

**Independent Test**: a queued command and a direct call carry `sort`; a bad `sort` reaches the callback as `bad_query`.

- [X] T013 [P] [US4] Add to `tests/unit/loader/commands.test.ts` (beside the existing `q` case): the query `{ sort: "popular", limit: 5, cursor: "c" }` reaches the delivery client unchanged; a bad `sort` returns the `bad_query` result to the callback and the returned promise, with the delivery client's own check doing the work (the loader adds none); add the same bad values to `tests/unit/loader/no-throw.test.ts` so a callback that throws or a bad `sort` never rejects
- [X] T014 [P] [US4] Add to `tests/browser/bundle.test.ts` (the jsdom test of the built script, beside the `q` case if there is one): a `fetchPage` command queued before the script loads and replayed after, and a direct `window.contentSdk.fetchPage("latest", { sort: "popular" })` call, each send `sort=popular` to the fake network; a queued command with `sort: "best"` calls back with `bad_query` naming `sort` and makes no request
- [X] T015 [US4] Make T013 and T014 pass; no loader code is expected to change (plan). If one does, say why in the commit

**Checkpoint**: the same option works through the module and the script tag, queued and direct.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T016 [P] Raise the version to `0.6.0` in `package.json` and `package-lock.json` (both places the lock file repeats it), and change the expected version in `tests/unit/package.test.ts` (FR-011)
- [X] T017 [P] Document the option in `README.md` next to the search section (FR-010, SC-005): the three values, that no `sort` keeps the service's order (newest first, best match first with `q`) and the SDK adds no default, that a cursor belongs to the order and the `q` that made it (keep both while paging; the service refuses another order with a `bad_query` naming `cursor`), that with `q` and a `sort` only the matches come back in that order, that a bad `sort` (including an empty one) is a `bad_query` naming `sort` without a request, how a script-tag page calls it, a short example of a home page of popular posts next to a search page in the default order, and the known limit of a `popular` list (ranked as of its first page; a changing view count can repeat or skip an item between pages)
- [X] T018 [P] Update the status paragraph of `CLAUDE.md`: feature 006, the sort option (version 0.6.0), built on the branch `006-fetchpage-sort`, tagged and taken by content-api only when the owner says so
- [X] T019 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; record the number of tests against T001 in `research.md` (a short "Build result" note); `dist/` is ignored by git, so there is nothing to commit from the build
- [X] T020 Walk through [quickstart.md](quickstart.md) item by item against the passing tests and record anything that differs; also read the README example against SC-005 (could a developer build a home page of popular posts and a search page in the default order from it alone?); the by-hand check against the hosted service is the owner's, after the tag is taken by content-api

---

## Dependencies & Execution Order

- Phase 1, then Phase 2 (T002 and T003 in parallel, then T004). Phases 3 to 6 need T004 and are independent of each other apart from sharing test files (tasks that touch the same file run one after another).
- Phase 7 needs all stories. T016 to T018 are parallel; T019 and T020 come last.

## Parallel Opportunities

- T002 with T003.
- T005 with T006; T008 with T009; T013 with T014.
- T016, T017 and T018 together.

## Implementation Strategy

**MVP**: Phases 1 to 4 give `sort` on `fetchPage` with its check, which is the whole behavior. Phases 5 and 6 prove paging and the script tag; Phase 7 documents and versions it. All of it ships in one pull request (one small feature). Stop at each checkpoint and show the result.
