---

description: "Task list for the event key (eventId on watchView and trackLinkClick)"
---

# Tasks: Send the Platform's Own Key for an Event (eventId)

**Input**: Design documents from `/specs/009-event-id/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R7), [data-model.md](data-model.md), [contracts/events-api-delta.md](contracts/events-api-delta.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail. Clock, timers, observer, beacon, fetch and the page-hidden signal are always the injected fakes of `tests/unit/events/helpers.ts`.

**Rules for every task**: no runtime dependency; no cookie, storage, random source or module-level state for the key, and no skipping or merging of calls the SDK has seen (FR-004, R4); nothing throws or rejects into the page; the loader, batcher, transport, view rule, click rule and `fetchPage` are not edited; every existing test passes **unedited** except where a task names the exact lines (SC-002): the only one is the version pin in `tests/unit/package.test.ts` (the test's name on line 20 and the assertion on line 25, `0.8.0` becomes `0.9.0`, T022); `placementId`, `actorRef`, `sessionId`, `externalRef` and `id` keep their rules and warnings; a bad key is left out and the event still sent (R3, owner 2026-11-21); no generated or default key, no new setting or export (R4); a warning never holds the value given (R6). Nothing is pushed, published, tagged or merged without the owner's go-ahead; the owner tags `v0.9.0` after the merge and content-api takes it in a pin-bump spec.

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done, `[~]` skipped by the owner. **[P]** can run in parallel (different files, no dependency on an open task).

Stories: US1 a platform gives an event its own key, US2 calls without an eventId behave as before, US3 a bad key is left out with one warning, US4 the SDK makes no key of its own, US5 the platform is told how to choose a key.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `009-event-id`, cut from an up-to-date `main` (v0.8.0, merge commit `c4c39ba`), and that `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass before any change; note the size of `dist/content-sdk.js` (14,295 bytes at the time of the plan) for T023

---

## Phase 2: Foundational

**Goal**: the type and the event shape every story uses.

- [X] T002 Add `eventId?: string` to `ViewOptions` in `src/types.ts` with a doc comment in the style of `sessionId`'s: this event's key, chosen by the platform, 1 to 128 characters of `A-Za-z0-9_.:-` (no slash), "The SDK makes none and keeps none" (contract: [events-api-delta](contracts/events-api-delta.md)); and `event_id?: string` to the shared keys of `EventRecord` in `src/events/rules.ts` (the `EventShared` interface), so both the item and the reference shape carry it. No behaviour yet; `npm run typecheck` passes and every existing test still passes unedited

**Checkpoint**: the shapes exist; nothing is read or sent yet.

---

## Phase 3: User Story 1 - A platform gives an event its own key (Priority: P1) 🎯 MVP

**Goal**: a valid `eventId` reaches the sent event as `event_id`, exactly as given, for items and references.

**Independent test**: with a fake transport, a view and a click, for an item and for a reference, each with an `eventId`, send one event with that `event_id`; five events across two keys each carry their own.

- [X] T003 [US1] Write the `tests/unit/events/rules.test.ts` additions first: `eventFor` with `{ eventId: "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b" }` returns an event with that `event_id` and no warning, for `view` and `link_click`, for an item (`{ id }`) and a reference (`{ externalRef }`); the value is kept as given (case, `_ . : -`, digits, exactly 128 characters, and a key that differs from another only in case); it sits beside `placement_id`, `actor_ref` and `session_id` when all are given and none affects another; an `eventId` equal to the `sessionId` or the `actorRef` is sent as given; no `event_id` key when none is given
- [X] T004 [US1] Implement the read, check and set in `src/events/rules.ts` (T003): add `const EVENT_ID = /^[A-Za-z0-9_.:-]{1,128}$/;`, read `options.eventId` in its own `try` like `sessionId` (a throwing getter: `[content-sdk] eventId could not be read; it was left out.`), accept a string that matches it and set `event.event_id`; `null` is absent. The invalid branch is T009 and lands in the same change, so a bad key is never sent
- [X] T005 [P] [US1] Write the `tests/unit/events/reporter.test.ts` additions first: through `createReporter` over the fake transport, `trackLinkClick(item, { eventId: "k-1" })` sends an event with `event_id: "k-1"`; `watchView(element, item, { eventId: "k-1" })` sends one once seen; the same for `{ externalRef }`; the same key on two calls sends two events, both with it (the SDK deduplicates nothing); 50 events across 5 keys each carry the key of their own call (SC-001); the other keys of those events are as before
- [X] T006 [P] [US1] Write the `tests/unit/events/library.test.ts` and `tests/unit/loader/commands.test.ts` additions first: the library calls `trackLinkClick(target, item, { eventId })` and `watchView(target, element, item, { eventId })` send it; the loader's `makeWatchView` and `makeTrackLinkClick` hand the options, an `eventId` among them, to the reporter unchanged; the queue form end to end is proven on the built script by T017 (no edit to `src/loader/` is expected)
- [X] T007 [US1] Run T003, T005 and T006 against T004; fix the code, not the tests, if a case fails

---

## Phase 4: User Story 3 - A bad key is left out with one warning (Priority: P2)

**Goal**: a key the service would refuse never reaches it; one plain warning; the event is still sent.

**Independent test**: `eventId` of `""`, 129 characters, `"a b"`, `"a/b"`, `"é"`, `"a\u0000b"`, `7`, `{}` each give an event without `event_id`, one warning without the value, no throw.

- [X] T008 [US3] Write the `tests/unit/events/rules.test.ts` additions first: an empty text, 129 characters (and 129 emoji), a space, a slash, an accented letter, an emoji, a NUL, a trailing newline, a number, a boolean, an object, a list, a function and a symbol each give the event without `event_id`, exactly one warning that starts with `[content-sdk] ` and says `eventId` must be 1 to 128 characters of `A-Z`, `a-z`, `0-9` and `_ . : -` and was left out, and the warning never contains the value given (use a recognisable value, SC-004); a throwing `eventId` getter is left out with one warning and nothing throws; a bad `eventId` never changes the event's other keys or warnings, and a bad `placementId`, `actorRef` or `sessionId` never changes a good `eventId`; options that are not an object keep their one existing warning and read no `eventId`; a reference event and an item event are both still built when the key is bad
- [X] T009 [US3] Add the invalid branch to `src/events/rules.ts` (T008), in the same change as T004: `[content-sdk] eventId must be 1 to 128 characters of A-Z, a-z, 0-9 and _ . : -; it was left out.`, with no value in it
- [X] T010 [P] [US3] Write the `tests/unit/events/no-throw.test.ts` additions first: `watchView` and `trackLinkClick` with an `eventId` of every hostile kind (getter that throws, proxy that throws on any access, Symbol, BigInt, a huge string, a cyclic object, a frozen options object) never throw or reject, and the event is still reported when the item is valid
- [X] T011 [US3] Write the `tests/unit/events/reporter.test.ts` additions first: a click with a bad `eventId` is still sent (without the key) and its warning reaches the injected `warn` once and never holds the value; a batch where one event has a bad key is sent whole, no event lost. Run T008, T010 and T011 against T009; fix the code if a case fails

---

## Phase 5: User Story 2 - Calls without an eventId behave as before (Priority: P1)

**Goal**: nothing a platform does today changes.

**Independent test**: an event with no `eventId` is byte for byte what v0.8.0 sent, with no warning.

- [X] T012 [US2] Write the `tests/unit/events/rules.test.ts` additions first: no options, empty options, `eventId: undefined` and `eventId: null` each give an event with no `event_id` **key** (check `"event_id" in event` and `JSON.stringify`) and no warning; the JSON of an item event and of a reference event with no `eventId` equals v0.8.0's for the same input; `actorRef: null` still warns as in v0.8.0
- [X] T013 [US2] Run the whole existing test set (`npm test`): every test not named in a task passes with **no edit** (SC-002, FR-005); fix the code if any fails

---

## Phase 6: User Story 4 - The SDK makes no key of its own (Priority: P2)

**Goal**: no key is made, stored or remembered, and no call is skipped.

**Independent test**: a call with a key then one without sends the key only on the first; the same call twice with no key sends two events; a lifecycle touches no storage, cookie or random source.

- [X] T014 [US4] Write the `tests/unit/events/reporter.test.ts` additions first: a click with `eventId: "k-1"` then a click with none: only the first has `event_id`, and nothing is remembered between calls (also for a watch started with a key and a later watch with none); the same item reported twice with no key leaves a batch of two events, no `event_id` on either; two reporters share nothing
- [X] T015 [US4] Write the `tests/browser/bundle.test.ts` additions first, on the built script in jsdom (`npm run build` first), in the style of the existing no-session test: with spies on `localStorage`, `sessionStorage`, `document.cookie`, `Math.random` and the `crypto` functions that exist, a lifecycle (load, watch a view with an `eventId`, report a click with none and a reference click with a key, page hidden so the batch leaves) reads or writes none of them from the SDK, the sent bodies carry `event_id` only on the events given one (SC-005), and the same key through the queue form and the direct call is sent as given
- [X] T016 [US4] Run T014 and T015 against the built script; fix the code if a case fails (no code is expected: the story is that nothing is added)

---

## Phase 7: Browser and contract

- [X] T017 [P] [US1] Add to `tests/browser/bundle.test.ts` the case where a queued `trackLinkClick` and `watchView` with `{ eventId }` and the direct calls send `event_id`, and a bad key sends the event without it and prints one warning that never holds the value (this proves FR-001 for the script-tag form)
- [X] T018 [P] Update `tests/contract/events-v1.test.ts` from content-api's `events-v1-delta` of spec 016 (read only): the validator learns `event_id` (absent or `null` allowed; otherwise text matching `^[A-Za-z0-9_.:-]{1,128}$`) with a new line beside the `session_id` check; add it to the contract example, and to the refused cases an empty, a 129-character, a spaced, a slash, an accented and a number key; every payload the SDK builds, item and reference events with and without a key and with a bad key left out, passes the validator (FR-008). Existing lines and cases stay as they are

---

## Phase 8: User Story 5 - The platform is told how to choose a key

- [X] T019 [P] [US5] Update `README.md`, "Reporting views and clicks": add `eventId` beside `sessionId` in the options list and in the example; say the platform supplies it per call and the SDK keeps nothing, that a bad one is left out with one warning and the event is still sent (so it may be stored twice), and carry every statement of User Story 5 / the contract's guidance: one event's key (not `sessionId`, not `actorRef`), pass the same key on the repeat, a fresh random key per call deduplicates nothing, each event its own key (a view and a click need two), never from public values only (a forged event with the same key would block yours; use a random UUID the platform keeps or a value only it can derive), the first stored wins, one key space per platform across item and reference events, raw counts are not for billing and a key removes repeats of one event, not repeated visits; a slash is not allowed in a key (unlike a reference); keep the link to the events contract
- [X] T020 [P] Add one line to `specs/004-view-events/contracts/events-api.md` pointing to `specs/009-event-id/contracts/events-api-delta.md`
- [X] T021 [P] Update `CLAUDE.md`'s status paragraph with feature 009: what it is, built on the branch `009-event-id`, the owner tags `v0.9.0` after the merge and content-api takes it in a pin-bump spec, a bad key is left out and the event sent (owner 2026-11-21), no generated key and no memory of calls (research R4), and the guidance on choosing a key

---

## Phase 9: Release

- [X] T022 Set the version to `0.9.0` in `package.json` and `package-lock.json` (both places that name this package, not a dependency's) and, in the same change, edit the one existing test that pins it: `tests/unit/package.test.ts`, the test's name (line 20, "… version 0.8.0") and the assertion (line 25, `expect(pkg.version).toBe("0.8.0")`), both to `0.9.0`
- [X] T023 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; all green with no skipped test; `dist/content-sdk.js` has grown by at most 1 KB over T001's size (SC-006), recorded in `research.md`; `git diff --stat main` shows no change under `src/fetch-page.ts`, `src/events/batcher.ts`, `src/events/transport.ts`, `src/events/watch.ts`, `src/events/reporter.ts` or `src/loader/`
- [X] T024 Walk `quickstart.md` steps 1 and 2; run the mutation check: remove the line that sets `event_id` and the sent-key tests must fail; make a bad key still be sent and the bad-key tests must fail
- [X] T025 Record in `research.md` every approach started and then rejected or reversed during the build (or state that there was none), and leave the hosted check below as the owner's

---

## Dependencies and order

- T001 then T002. T003, T005, T006 and T008 (tests, the last for the bad-key branch) are written first, in parallel where the files differ, and seen to fail; then T004 and T009 land as **one change** in `rules.ts`; then T007 and T011 run the tests against it.
- Phase 4 extends the same function and test file as Phase 3: T008 is written before T004 and T009 (see above); T010 is in another file and can be written in parallel with T008. `tests/unit/events/reporter.test.ts` is shared by T005, T011 and T014 (not `[P]` with each other); `rules.test.ts` by T003, T008, T012; `tests/browser/bundle.test.ts` by T015 and T017, so those two are not parallel with each other.
- Phases 5 and 6 need Phases 3 and 4 and should need no new production code, only tests (a failure is fixed in `rules.ts`, not in a test).
- Phase 7: T017 and T018 in parallel; T017 needs a build. Phase 8 tasks are documents in different files and run in parallel after the stories. Phase 9 last.

## Implementation strategy

MVP is Phases 1 to 3 together with T009 (the check is never left out of the change, so a bad key is never sent). Phase 4 proves the refusal-first protection of the batch; Phases 5 and 6 are compatibility and "no key of its own" proofs and should need no new code; Phase 8 is the guidance the spec requires.

## Hosted checks (the owner's, not part of this change)

- The owner tags `v0.9.0` on the merge commit, and a later content-api spec takes the tag (a pin bump, as specs 013 to 023 did); nothing is tagged or published by this change.
- After content-api serves `0.9.0`, two clicks reported from listings with one `eventId` store one row with that `event_id` in Neon (quickstart step 3), and one with a key the SDK found bad stores a row with no key.

---

## Phase 10: Convergence

- [X] T026 Add one sentence to `specs/009-event-id/contracts/events-api-delta.md` (after the opening paragraph) saying that from version 0.9.0 the `eventId` option is offered, so the line "no `eventId` option or generated event id" under "Not in this version" in `specs/005-session-id/contracts/events-api-delta.md` is history (a generated event id is still not made); leave the spec 005 file as it is, per plan: research R7 (partial)
