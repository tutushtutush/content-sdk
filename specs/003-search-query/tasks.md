# Tasks: Search Option

**Input**: Design documents from `/specs/003-search-query/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (D1 to D8), [data-model.md](data-model.md), [contracts/query-q.md](contracts/query-q.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail.

**Rules for every task**: no runtime dependency, no new error kind, no new result field, no new module; a call without `q` builds the byte-identical address (FR-003); nothing throws or rejects into the page (FR-010); the content-api contract files are read only. Nothing is tagged, pushed, merged or published without the owner's go-ahead (CLAUDE.md).

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done. **[P]** can run in parallel (different files, no dependency on an open task). Stories: US1 search a placement, US2 follow a search, US3 from a script tag, US4 a bad text is a typed error.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `003-search-query` and that `npm run typecheck`, `npm run lint` and `npm test` pass before any change

---

## Phase 2: Foundational

**Goal**: the type and the one check that every story uses.

- [X] T002 [P] Write the tests first in `tests/unit/request.test.ts` (new `describe("q")`): absent and `undefined` send no `q`; `""`, `"   "` and a tab-and-newline text send no `q`; `"toyota corolla"` gives `?q=toyota+corolla`; the text is sent unchanged, spaces at its ends included (`" a "` decodes to `" a "`); Amharic `መኪና ፡ ቶዮታ` decodes back to the same text; each of `& = # + % ? / \ ' " < >` and a newline decodes back to the same text and leaves exactly one parameter named `q` (use `new URL(...).searchParams`); `q` together with `limit`, `tags`, `languages` and `cursor` sends all five; 100 characters pass, 101 give `bad_query` with `fields: ["q"]`; 100 three-byte characters (`"አ".repeat(100)`) pass and 101 do not (characters, not bytes); 100 characters plus spaces around them pass; an emoji counts as one character; `5`, `{}`, `["a"]`, `null`, `true` each give `bad_query` with `fields: ["q"]`; a lone surrogate `"\uD800"` does not throw and is sent; a query with only `q` leaves `limit`, `tag`, `language`, `cursor` out
- [X] T003 Add `q?: string` to `Query` in `src/types.ts` with a doc comment (text, at most 100 characters after trimming, empty means not given, the service decides matching and order, pass the same `q` with a cursor)
- [X] T004 Implement the check in `src/request.ts` (T002): a constant for the 100-character limit; for `q !== undefined`, a non-string or a trimmed text over 100 characters (`[...text.trim()].length`) returns `badQuery({ fields: ["q"] })`; a string that is empty after trimming sets nothing; otherwise `params.set("q", q.q)` unchanged; keep it one small function in the style of `checkList`

**Checkpoint**: the request builder sends and refuses `q` as specified.

---

## Phase 3: User Story 1 - Search a placement by words (Priority: P1)

**Goal**: `fetchPage` sends `q` and returns the service's items as before.

**Independent Test**: a fake service receives `q=toyota+corolla`; the result holds the fake's items in its order; without `q` no `q` is sent.

- [X] T005 [US1] Add to `tests/unit/fetch-page.test.ts`: with a recording fake, a call with `q` makes one request whose address carries `q`; the result is `{ ok: true, page }` with the fake's items in the fake's order and its cursor; an empty page for a search is a success; a call without `q`, and with `q: ""`, requests the same address as before (compare with the address of a call that has no query)
- [X] T006 [US1] Run T005; fix `src/request.ts` only if a case fails

---

## Phase 4: User Story 2 - Follow a search to the next page (Priority: P2)

- [X] T007 [US2] Add to `tests/unit/paging.test.ts`: a first page with `q` and a next cursor, then a second call with the same `q` and that cursor, requests an address carrying both unchanged; two calls in a row do not share anything (the second call without `q` sends none); a fake answering `422` with `details.fields` naming `cursor` for a cursor made for another `q` gives `bad_query` with `fields: ["cursor"]` and one request only (no retry)
- [X] T008 [US2] Run T007; fix only if a case fails

---

## Phase 5: User Story 3 - Search from a script tag (Priority: P2)

- [X] T009 [P] [US3] Add to `tests/unit/loader/commands.test.ts`: `q` in the query reaches the delivery client unchanged (the query object is passed as given, with `q`), and a `bad_query` result for `q` reaches the callback and the promise like any other result
- [X] T010 [P] [US3] Add to `tests/browser/bundle.test.ts`: in the jsdom page with the built script, a command queued before load with `q` is replayed and its request carries `q`; after load, `window.contentSdk.fetchPage("latest", { q: "toyota" })` sends `q`; `q` that is a number gives a `bad_query` result with `fields: ["q"]` and no request (no loader code change is expected; if a case fails, fix the cause, not the test)

---

## Phase 6: User Story 4 - A bad search text is a typed error (Priority: P2)

- [X] T011 [P] [US4] Add to `tests/unit/no-throw.test.ts` the cases `q: 5`, `q: {}`, `q: ["a"]`, `q: null`, `q: "x".repeat(101)`, and `q: "\uD800"`, each resolving (never rejecting) to a result; a getter that throws is not covered, for `q` or for any other field (see research D9); the "at least 20 cases" count test must still hold
- [X] T012 [P] [US4] Create `tests/contract/search-v1.test.ts` (read only against `/Users/tsega/Documents/Git/content-api/specs/012-search-q/contracts/search-v1.md`; the file's rules are written into the test as comments naming the contract line): the request carries `q` and nothing else the caller did not give; a `422` body in the service's error form naming `q` (`{ "error": { "code": "invalid", "message": "...", "details": { "fields": [{ "field": "q", "message": "..." }] } } }`, copy the shape from `tests/contract/fixtures/delivery-v1.ts`; the search contract names no separate body, the service has one error shape, so the live case in T014 confirms it) gives `bad_query` with `fields: ["q"]` and the service's message as `serviceMessage`; a `200` for a search is read as any page; an unknown extra field in a search answer is ignored
- [X] T013 [US4] Run T011 and T012; fix `src/request.ts` only if a case fails

---

## Phase 7: Polish

- [X] T014 [P] Update `tests/live/live.test.ts` (runs only with `CONTENT_SDK_LIVE=1`): one search for a word that is certainly absent returns `ok: true` with no items, and one search for a symbols-only text returns `bad_query` naming `q`; a search for a word that is present is by hand only (the quickstart), because it depends on the hosted data; do not run it without the owner's go-ahead
- [X] T015 [P] Update `README.md`: add `q` to the query list and the example; say it is text of at most 100 characters, that empty means no search, that matching and order are the service's (words and word starts, case ignored, best match first), that a cursor belongs to its `q` (pass the same `q` with it), that `bad_query` names `q`, and that it works from the script tag the same way
- [X] T016 Raise the version to `0.3.0` in `package.json` and in `package-lock.json` (the root package entries only), and update `tests/unit/package.test.ts` (the test name and the expected version)
- [X] T017 Update `CLAUDE.md` status in this repository (feature 003, the search option; 001 and 002 merged) and add the final record to `research.md` (approaches started and reversed: say none if none; D1 to D8 still match what was built)
- [X] T018 Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm test` (the hosted live test is excluded); run `npm test` twice more for stability; `git diff main --stat` and confirm only the files this plan names changed (no new module); check that `dist/content-sdk.js` is still one minified script with a source map
- [ ] T019 GATED: the owner decides when to push, open the pull request and merge. Put in the pull request text: additive change, version 0.3.0, no runtime dependency, and that content-api serves the old script until its pinned tag moves
- [ ] T020 GATED, the owner's: after the merge, create the tag `v0.3.0`, then (a separate content-api change with its own spec-kit run) move content-api's pinned tag and deploy; the optional live check (T014) runs after that

---

## Dependencies and order

- Phase 1, then Phase 2. T002 is the test for T004 and can be written with T003. Phases 3 to 6 follow Phase 2 and are independent of each other; T009, T010, T011 and T012 touch different files and can run together. Phase 7 follows. T019 and T020 are the owner's.

### Parallel examples

- T002 and T003 touch different files.
- T009, T010, T011, T012 touch different files.
- T014 and T015 touch different files.

## Implementation strategy

MVP is Phases 1 to 3: the SDK sends `q`. Phases 4 to 6 prove paging, the script tag and bad input; Phase 7 documents and versions it. One pull request, built and shown, and nothing pushed until the owner says so.

---

## Phase 8: Convergence

- [X] T021 Fix the stale wording in `specs/003-search-query/quickstart.md` line 15: the second live case is a symbols-only text that the service refuses, giving `bad_query` naming `q` (as written in `tests/live/live.test.ts`), not "a `limit`-free search that must come back `ok`", per SC-005 and T014 (partial)
