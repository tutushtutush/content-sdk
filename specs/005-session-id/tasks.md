---

description: "Task list for the session id option (sessionId on watchView and trackLinkClick)"
---

# Tasks: Report the Visit with a Session Id

**Input**: Design documents from `/specs/005-session-id/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R8), [data-model.md](data-model.md), [contracts/events-api-delta.md](contracts/events-api-delta.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail. Clock, timers, observer, beacon, fetch and the page-hidden signal are always the injected fakes of `tests/unit/events/helpers.ts`.

**Rules for every task**: no runtime dependency; no cookie, storage, random source or module-level state for the id (FR-005); nothing throws or rejects into the page; the loader, batcher, transport, view rule and click rule are not edited; every existing test passes **unedited** except where a task names the exact lines (SC-002): the only one is the version pin in `tests/unit/package.test.ts` (the test's name on line 20 and the assertion on line 25, `0.4.0` becomes `0.5.0`, T022); `placementId` and `actorRef` keep their rules and warnings, `actorRef: null` included (R4); no `event_id`, no generated or default session id, no global setting or tag attribute (R2, R3); a warning never holds the value given (R5). Nothing is pushed, published, tagged or merged without the owner's go-ahead; the owner tags `v0.5.0` after the merge and content-api takes it in its own spec.

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done, `[~]` skipped by the owner. **[P]** can run in parallel (different files, no dependency on an open task).

Stories: US1 a platform says which visit a view or click belongs to, US2 calls without a session id behave as before, US3 a bad session id is left out and the rest is reported, US4 the SDK makes no session of its own.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `005-session-id`, cut from an up-to-date `main` (v0.4.0), and that `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass before any change; note the size of `dist/content-sdk.js` (13,146 bytes at the time of the plan) for T023

---

## Phase 2: Foundational

**Goal**: the type and the event shape every story uses.

- [X] T002 Add `sessionId?: string` to `ViewOptions` in `src/types.ts` with a doc comment in the style of `actorRef`'s: the visit the event belongs to, chosen by the platform, 1 to 128 characters with no NUL, "The SDK makes none and stores none" (contract: [events-api-delta](contracts/events-api-delta.md)); and `session_id?: string` to `EventRecord` in `src/events/rules.ts` with the other optional keys. No behaviour yet; `npm run typecheck` passes and every existing test still passes unedited

**Checkpoint**: the shapes exist; nothing is read or sent yet.

---

## Phase 3: User Story 1 - A platform says which visit a view or click belongs to (Priority: P1) 🎯 MVP

**Goal**: a valid `sessionId` reaches the sent event as `session_id`, exactly as given.

**Independent test**: with a fake transport, a click with `sessionId: "s-7f3a"` produces one event with `session_id: "s-7f3a"`; the same for a view; five events across two ids each carry their own.

- [X] T003 [US1] Write the `tests/unit/events/rules.test.ts` additions first: `eventFor` with `{ sessionId: "s-7f3a" }` returns an event with `session_id: "s-7f3a"` and no warning, for `view` and for `link_click`; the value is kept as given (case, spaces, a slash, non-ASCII letters, 128 characters, and 128 emoji counted as characters); it sits beside `placement_id` and `actor_ref` when all three are given and none affects another; a `sessionId` equal to the `actorRef` is sent as given
- [X] T004 [US1] Implement the read, check and set in `src/events/rules.ts` (T003): read `options.sessionId` in its own `try` like `placementId` and `actorRef`, accept text of 1 to 128 characters (counted as characters) with no NUL, set `event.session_id`; the invalid branch is T008. Keep the shape of the `actorRef` block so the two read alike
- [X] T005 [P] [US1] Write the `tests/unit/events/reporter.test.ts` additions first: through `createReporter` over the fake transport, `trackLinkClick(item, { sessionId: "s-1" })` sends an event with `session_id: "s-1"`; `watchView(element, item, { sessionId: "s-1" })` sends one with it once the view is seen; five events reported across two session ids (batched together) each carry the id of their own call and stay five events (SC-001); the `occurred_at`, `placement_id` and `actor_ref` of those events are as before
- [X] T006 [P] [US1] Write the `tests/unit/loader/commands.test.ts` additions first, where that file covers the event calls that `src/loader/commands.ts` wraps (`watchView` and `trackLinkClick`): the options object with `sessionId` reaches the reporter unchanged, exactly as for `placementId` and `actorRef`; the queue form end to end (`["trackLinkClick", item, { sessionId: "s-1" }]`, `["watchView", element, item, { sessionId: "s-1" }]`) is proven on the built script by T016 (FR-004); no edit to `src/loader/` is expected (R7)
- [X] T007 [US1] Run T003, T005 and T006 against T004; fix the code, not the tests, if a case fails, and record in `research.md` any approach started and rejected

---

## Phase 4: User Story 3 - A bad session id is left out and the rest is reported (Priority: P2)

**Goal**: a value the service would refuse never reaches it, with one plain warning, and the event is still reported.

**Independent test**: `sessionId` of `""`, 129 characters, `"a\u0000b"`, `7`, `{}` each give an event without `session_id`, one warning that does not hold the value, and no throw.

- [X] T008 [US3] Write the `tests/unit/events/rules.test.ts` additions first: an empty text, one of 129 characters (and 129 emoji), one holding a NUL, a number, a boolean, an object, a list and a function each give the event without `session_id`, exactly one warning that says `sessionId` was left out and the rule, and the warning never contains the value given (use a recognisable value and check the text, SC-004); a `sessionId` getter that throws is left out with one warning and nothing throws; a bad `sessionId` never changes the event's other keys or warnings, and a bad `placementId` or `actorRef` never changes a good `sessionId`; options that are not an object keep their one existing warning and read no `sessionId`
- [X] T009 [US3] Add the invalid branch to `src/events/rules.ts` (T008): the warning in the style of the existing ones, `[content-sdk] sessionId must be 1 to 128 characters of text; it was left out.`, with no value in it
- [X] T010 [P] [US3] Write the `tests/unit/events/no-throw.test.ts` additions first: `watchView` and `trackLinkClick` with a `sessionId` of every hostile kind (getter that throws, proxy that throws on any access, a Symbol, a BigInt, a huge string, a cyclic object, a frozen object) never throw or reject, and the event is still reported when the item is valid
- [X] T011 [US3] Write the `tests/unit/events/reporter.test.ts` additions first: a click with a bad `sessionId` is still sent (without the key) and its warning reaches the injected `warn` once; a batch of events where one has a bad `sessionId` is sent whole, no event lost
- [X] T012 [US3] Run T008, T010 and T011 against T009; fix the code if a case fails

---

## Phase 5: User Story 2 - Calls without a session id behave as before (Priority: P1)

**Goal**: nothing a platform does today changes.

**Independent test**: an event with no `sessionId` is byte for byte what v0.4.0 sent, with no warning.

- [X] T013 [US2] Write the `tests/unit/events/rules.test.ts` additions first: no options, empty options, `sessionId: undefined` and `sessionId: null` each give an event with no `session_id` **key** (not `undefined`, not `null`: check with `"session_id" in event` and by `JSON.stringify`) and no warning; the JSON of an event with no `sessionId` equals the JSON v0.4.0 produced for the same input (take it from the existing expectations); `actorRef: null` still warns as in v0.4.0
- [X] T014 [US2] Run the whole existing test set (`npm test`): every test not named in a task passes with **no edit** (SC-002, FR-006); fix the code if any fails

---

## Phase 6: User Story 4 - The SDK makes no session of its own (Priority: P2)

**Goal**: no id is made, stored or remembered by the SDK.

**Independent test**: a call with a `sessionId` followed by one without sends the id only on the first; a full lifecycle touches no storage, cookie or random source.

- [X] T015 [US4] Write the `tests/unit/events/reporter.test.ts` additions first: a click with `sessionId: "s-1"` then a click with none: only the first event has `session_id`, and nothing is remembered between calls (also for a watch started with an id and a later watch with none); two reporters (two targets) share nothing
- [X] T016 [US4] Write the `tests/browser/bundle.test.ts` additions first, on the built script in jsdom: with spies on `localStorage`, `sessionStorage`, `document.cookie` and `Math.random`, and on `crypto.getRandomValues` and `crypto.randomUUID` for each of those the jsdom environment provides, a full lifecycle (load, watch a view with a `sessionId`, report a click without one, page hidden so the batch leaves) reads or writes none of them from the SDK, and the sent bodies carry `session_id` only on the event that was given one (SC-005, FR-005); add a check that the built script's sent event has the id given through the queue form
- [X] T017 [US4] Run T015 and T016 against the built script (`npm run build` first); fix the code if a case fails (no code is expected: the point of the story is that nothing is added)

---

## Phase 7: Contract, documents and release

- [X] T018 [P] Update `tests/contract/events-v1.test.ts`: the validator learns `session_id` (text of 1 to 128 characters counted as characters, no NUL) from content-api's `events-v1-delta` (spec 017, read only); add it to the contract example and to the refused cases (empty, 129 characters, NUL); every payload the SDK builds, with and without a `sessionId`, passes the validator (FR-010)
- [X] T019 [P] Update `README.md`, "Reporting views and clicks": add `sessionId` beside `placementId` and `actorRef` in the options list and in the example, say the platform supplies it per call and the SDK keeps nothing between calls, that `actorRef` stays the user or device, and that values should be random or hashed, never an email, a name or anything that identifies a person; keep the README's existing link to the events contract
- [X] T020 [P] Add one line to `specs/004-view-events/contracts/events-api.md` pointing to `specs/005-session-id/contracts/events-api-delta.md` (its "Not in this version" line lists no session id, so it stays as it is)
- [X] T021 [P] Update `CLAUDE.md`'s status paragraph with spec 005: what it is, that it is built on the branch `005-session-id`, that the owner tags `v0.5.0` after the merge and content-api takes it in its own spec, and that no default or generated session id exists (R2)
- [X] T022 Set the version to `0.5.0` in `package.json` and `package-lock.json` (both places that name this package, not a dependency's) and, in the same change, edit the one existing test that pins it: `tests/unit/package.test.ts`, the test's name (line 20, "… version 0.4.0") and the assertion (line 25, `expect(pkg.version).toBe("0.4.0")`), both to `0.5.0`
- [X] T023 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; all green with no skipped test; `dist/content-sdk.js` has grown by at most 1 KB over T001's size (SC-006), and the size is recorded in `research.md`
- [X] T024 Walk `quickstart.md` steps 1 and 2 (the automated run and what the tests show)
- [X] T025 Record in `research.md` every approach started and then rejected or reversed during the build (or state that there was none), and leave the hosted checks below as the owner's

---

## Dependencies and order

- T001 then T002. T003, T005 and T006 (tests) can be written in parallel after T002; T004 follows T003, and T007 runs them against T004.
- Phase 4 follows Phase 3 (it extends the same function): T008 then T009; T010 and T011 are tests in different files and can be written in parallel with T008.
- Phase 5 and Phase 6 need Phases 3 and 4; they should need no new production code, only tests (if one fails, the fix goes in `rules.ts`, not in a test). T015 and T016 are written one after another with T011 and T005 where they share a file (`tests/unit/events/reporter.test.ts` is shared by T005, T011 and T015, so those are not `[P]` with each other).
- Phase 7 after the stories; T018 to T021 are in different files and can run in parallel; T022 to T025 last.

## Implementation strategy

MVP is Phases 1 to 3: with the type and the read in `rules.ts`, a valid `sessionId` is sent. Phase 4 adds the refusal-first protection of the batch; Phases 5 and 6 are proofs of compatibility and of the "no session of its own" rule and should need no new code. Repeat the mutation check of content-api spec 016 where it applies: remove the line that sets `event.session_id` and the sent-value tests must fail.

## Hosted checks (the owner's, not part of this change)

- The owner tags `v0.5.0` on the merge commit, and a later content-api spec takes the tag (as specs 013 and 015 did); nothing is tagged or published by this change.
- After content-api serves `0.5.0` and is deployed, a click reported from listings with a `sessionId` has it in the Neon row (quickstart step 3).

---

## Phase 8: Convergence

- [X] T026 Add a case to `tests/unit/events/library.test.ts`: the library form `createLibrary(globals).trackLinkClick(target, item, { sessionId: "s-1" })` sends an event with `session_id: "s-1"`, and `watchView(target, element, item, { sessionId: "s-1" })` sends it once the view is seen; a call with no `sessionId` sends none; a bad one is left out with one warning, as for the direct calls per FR-001 (partial)
