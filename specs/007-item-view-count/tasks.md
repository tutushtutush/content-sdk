# Tasks: Item View Count

**Input**: Design documents from `/specs/007-item-view-count/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R10), [data-model.md](data-model.md), [contracts/item-view-count.md](contracts/item-view-count.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail.

**Rules for every task**: no runtime dependency, no new error kind, no new option, no new module; the request address of every call is unchanged (FR-005); `view_count` is required, never defaulted and never optional (FR-002, FR-003); the count is never tested by truthiness (research R5); nothing throws or rejects into the page (FR-009); the content-api contract files are read only. Nothing is tagged, pushed, merged or published by these tasks; the owner does that.

**Build notes (2026-11-18)**: baseline (T001) 58 suites and 1818 tests; at the end 62 suites and 1946 tests, with typecheck, lint and build clean. Where the build differs from the text below: the validator, fetch-level and no-throw tests (T002, T006, T010, T011, and the request-address check of T015) are in one new file, `tests/unit/view-count.test.ts`, not added to `validate.test.ts`, `fetch-page.test.ts`, `no-throw.test.ts` and `request.test.ts`; the contract test is `tests/contract/item-view-count.test.ts` (T008); the type checker found no hand-built `Item` in the tests (they all spread the shared example), so the only fixtures to change were `exampleItem` and the three nine-field key lists (T004, T007); `tests/unit/events/` needed no change and passes (T015). The opt-in live test was updated for the ten fields but not run (T020: it calls the hosted service, and the owner did not ask).

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done. **[P]** can run in parallel (different files, no dependency on an open task). Stories: US1 a platform shows how many times a post was viewed, US2 a missing or wrong count refuses the page, US3 everything else stays as it was.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `007-item-view-count`, cut from an up-to-date `main` (which holds feature 006, merge `8344c41`), and that `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass before any change; note the number of suites and tests

---

## Phase 2: Foundational

**Goal**: the field, the example and the one check that every story uses.

- [X] T002 [P] Write the tests first in `tests/unit/validate.test.ts` (new `describe("parsePage: view_count")`): items with `view_count` of `0`, `1`, `7`, `1204` and `Number.MAX_SAFE_INTEGER` are returned with exactly that number, the other nine fields as before and the items in the given order; `-0` is returned as `0` (check with `Object.is(value, 0)`); `0` is not taken for missing; each of the following in one item makes the result `{ problem }` naming `view_count` and returns no page: the key missing, `null`, `undefined`, `"5"`, `"abc"`, `true`, `[1]`, `{}`, `-1`, `1.5`, `NaN`, `Infinity`, `-Infinity`, `2 ** 53`, `1e300`, `Symbol` (at least twelve values, SC-002); one bad item among three refuses the whole page and returns none of them; the problem text contains no text from the item
- [X] T003 Add `view_count: number` to `Item` in `src/types.ts`, after `created_at`, with a doc comment (the number of `view` events the service stored for the item from every platform that reported one; raw: not a count of people, not for billing, may become stricter; `0` when none; passed on as the service sent it, never formatted or summed)
- [X] T004 Update the shared example: add `view_count: 1204` to `exampleItem` in `tests/contract/fixtures/delivery-v1.ts` (the service's own example carries one; keep the header comment naming `specs/019-item-view-counts/contracts/delivery-v1-delta.md` as a source), and replace the nine-field lists in `tests/contract/delivery-v1.test.ts` (the `Object.keys` expectation near line 43) and `tests/live/live.test.ts` (near line 17) with the ten fields, `view_count` last in alphabetical order; run `npm run typecheck` and fix every hand-built item the compiler finds (the type now requires the field)
- [X] T005 Implement `parseViewCount` in `src/validate.ts` (T002): `typeof value === "number" && Number.isSafeInteger(value) && value >= 0` returns the number (with `-0` returned as `0`), anything else returns nothing; read `view_count` with the other fields in `parseItem`, return `"item view_count is not a whole number of 0 or more"` when it is not good, and add it to the returned item after `created_at`. Test the type and the number, never truthiness. Make no other change to the file

**Checkpoint**: the validator returns and refuses `view_count` as specified; every existing test passes with the updated fixture.

---

## Phase 3: User Story 1 - A platform shows how many times a post was viewed (Priority: P1)

**Goal**: each item `fetchPage` returns carries the service's number.

**Independent Test**: a fake service answers a page whose items carry `1204`, `0` and `7`; the result has exactly those numbers, the other fields as before.

- [X] T006 [P] [US1] Add tests to `tests/unit/fetch-page.test.ts`: a page of three items with `view_count` `1204`, `0` and `7` returns them in order with those numbers; the numbers are not formatted, rounded or summed (`1204`, never `"1,204"`); an item the service never counted (`0`) has `0`, a number and not missing; the same with `sort`, `q`, `tags`, `languages`, `limit` and `cursor` in the query, and the request address is the one 0.6.0 built (compare with the address expected by the existing tests)
- [X] T007 [P] [US1] Update `tests/unit/sort.test.ts`: the ten-field expectation (`created_at`, `description`, `id`, `images`, `language`, `platform`, `tags`, `title`, `url`, `view_count`) replaces the nine-field one and its comment (the SDK now returns the service's `view_count`; research R10 of feature 006 is resolved by this feature); the contract test `tests/contract/delivery-sort.test.ts` needs no change beyond the fixture
- [X] T008 [P] [US1] Write `tests/contract/item-view-count.test.ts` (new, beside `delivery-sort.test.ts`), with a header naming the rules read from content-api `specs/019-item-view-counts/contracts/delivery-v1-delta.md` (read only): the item example of the delta (with `view_count`) is read as an item and returned with the count; the count is on every item of a page; `0` is valid and common; a count past the safe-integer limit, a fraction, a negative number, text and `null` refuse the page as `contract_mismatch` with status 200 and the message naming `view_count`; the page and the item keys are the ten and `next_cursor` as before
- [X] T009 [US1] Make T006 to T008 pass (they should pass with T005; fix the code, not the tests, unless a test is wrong)

**Checkpoint**: a platform can show "N views" from the item as plain data.

---

## Phase 4: User Story 2 - A missing or wrong count refuses the page (Priority: P1)

**Goal**: every bad value is a typed `contract_mismatch` for the whole page, never a throw and never a guess.

**Independent Test**: each bad value resolves to `{ ok: false, error }` with kind `contract_mismatch`, and no items.

- [X] T010 [P] [US2] Add to `tests/unit/fetch-page.test.ts`: the fake fetch carries only JSON, so use the bad values JSON can carry, as raw text bodies where a value would otherwise change in `JSON.stringify` (`1e999`, which parses to `Infinity`, `1e300`, `9007199254740992`, `-1`, `1.5`, `"5"`, `"abc"`, `true`, `[1]`, `{}`, `null`, and the key missing): `fetchPage` resolves to `{ ok: false, error: { kind: "contract_mismatch", status: 200 } }` with a message containing `view_count`, the result has no `page`, and the fake was called once (no retry); one bad item among three refuses the whole page. The values JSON cannot carry (`NaN`, a symbol, a throwing `toString`, a `Proxy`) are covered at the validator, in T002
- [X] T011 [P] [US2] Add to `tests/unit/no-throw.test.ts`, in the style of the existing cases (raw text bodies through `answer(200, text)`): an item whose `view_count` is `null`, `"5"`, `{}`, `["1"]`, `1e999`, `1e300`, `-0`, `0` or missing, each resolves and never rejects; and, calling `parsePage` directly, items whose `view_count` is `NaN`, a symbol, an object whose `toString` throws, a `Proxy` and a function return `{ problem }` and never throw
- [X] T012 [US2] Make T010 and T011 pass; if a value throws inside the check (a getter, a `Proxy`, a throwing `toString`), only `typeof` and `Number.isSafeInteger` may touch it, never string conversion

**Checkpoint**: no value the service sends for `view_count` can make the SDK throw, default or return a partial page.

---

## Phase 5: User Story 3 - Everything else stays as it was (Priority: P1)

**Goal**: the request, the other fields, the errors, the loader and the events are unchanged, and the count reaches the page through the script tag.

**Independent Test**: every existing test passes once its example items carry `view_count`; the built script returns the count.

- [X] T013 [P] [US3] Add to `tests/unit/loader/commands.test.ts`: a result whose items carry `view_count` is handed to the callback and the promise as the same object the delivery client returned (the loader adds, drops and copies nothing); a `contract_mismatch` result for a bad count is handed on as it is
- [X] T014 [P] [US3] Add to `tests/browser/bundle.test.ts` (the jsdom test of the built script; the fake fetch in that file returns `examplePage`, which now carries the count): a queued `fetchPage` command and a direct `window.contentSdk.fetchPage` call each give a page whose first item has `view_count` `1204`; a service body with a bad count gives `contract_mismatch` to the callback and the promise, and nothing throws
- [X] T015 [P] [US3] Pin the unchanged parts: in `tests/unit/request.test.ts` or `fetch-page.test.ts` an address built with every option is byte-identical to the one 0.6.0 built (the existing address tests already assert it; add one explicit full-query case if none does), and `tests/unit/events/` needs no change (run them and say so)
- [X] T016 [US3] Make T013 to T015 pass; no loader or events code is expected to change (plan). If one does, say why in the commit

**Checkpoint**: the same page, with the count, reaches the platform through the module and the script tag; nothing else moved.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Raise the version to `0.7.0` in `package.json` and `package-lock.json` (both places the lock file repeats it, lines 3 and 9), and change the expected version in `tests/unit/package.test.ts` (FR-011)
- [X] T018 [P] Document the field in `README.md` (FR-010, SC-005), next to the description of the item: `view_count` in the item and in the examples that show an item; a short example showing "N views" beside a post; that it is the number of `view` events the service stored for the item from every platform that reported one (including other platforms), raw (a visitor who refreshes ten times can add ten), not a count of people and not for billing, and may become stricter later; that the SDK passes it on and never formats, sums or adjusts it, and the wording is the platform's; that a page whose item has no valid `view_count` is refused as `contract_mismatch`; and that code which builds `Item` values by hand (tests, mocks) needs the field
- [X] T019 [P] Update the status paragraph of `CLAUDE.md`: feature 007, the item view count (version 0.7.0), required and validated, built on the branch `007-item-view-count`; the owner tags `v0.7.0` after the merge and content-api takes it in its spec 021; and note that feature 006's research R10 is resolved here
- [X] T020 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; record the numbers against T001 in `research.md` (a short "Build result" note); `dist/` is ignored by git, so nothing from the build is committed; run the opt-in live test (`CONTENT_SDK_LIVE=1`) only if the owner asks, because it calls the hosted service
- [X] T021 Walk through [quickstart.md](quickstart.md) item by item against the passing tests and record anything that differs; also read the README against SC-005 (could a developer show "N views" and say what the number means from it alone?); the by-hand check against the hosted service is the owner's, after the tag is taken by content-api

---

## Dependencies & Execution Order

- Phase 1, then Phase 2 (T002 and T003 in parallel, T004 after T003, T005 last). Phases 3 to 5 need T005 and are independent of each other apart from sharing test files (tasks that touch the same file run one after another).
- Phase 6 needs all stories. T017 to T019 are parallel; T020 and T021 come last.

## Parallel Opportunities

- T002 with T003.
- T006, T007 and T008; T010 with T011; T013, T014 and T015.
- T017, T018 and T019 together.

## Implementation Strategy

**MVP**: Phases 1 to 4 give the field with its check, which is the whole behavior. Phase 5 proves nothing else moved and the script tag carries it; Phase 6 documents and versions it. All of it ships in one pull request (one small feature). Stop at each checkpoint and show the result.
