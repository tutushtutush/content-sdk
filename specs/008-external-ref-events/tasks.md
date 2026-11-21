---

description: "Task list for external-reference events (externalRef in place of an item id on watchView and trackLinkClick)"
---

# Tasks: Report Events About Things That Are Not Items (External Reference)

**Input**: Design documents from `/specs/008-external-ref-events/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R7), [data-model.md](data-model.md), [contracts/events-api-delta.md](contracts/events-api-delta.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail. Clock, timers, observer, beacon, fetch and the page-hidden signal are always the injected fakes of `tests/unit/events/helpers.ts`.

**Rules for every task**: no runtime dependency; nothing throws or rejects into the page; the loader, batcher, transport, view rule, click rule, `fetchPage` and the options' rules are not edited; every existing test passes **unedited** except where a task names the exact lines (SC-002): the only ones are the version pin in `tests/unit/package.test.ts` (the test's name on line 20 and the assertion on line 25, `0.7.0` becomes `0.8.0`, T024) and the validator line in `tests/contract/events-v1.test.ts` (line 22, the `item_id` check, T020); no `event_id`, no default or invented placement, no allowed-prefix rule, no new setting or public export (R5, R6); a warning never holds the reference or id given (R4). Nothing is pushed, published, tagged or merged without the owner's go-ahead; the owner tags `v0.8.0` after the merge and content-api takes it in a pin-bump spec.

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done, `[~]` skipped by the owner. **[P]** can run in parallel (different files, no dependency on an open task).

Stories: US1 report a view or click about something not stored, US2 item events behave as before, US3 a bad reference is refused locally without printing it, US4 both or neither is refused, US5 the platform is told what to put in a reference.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `008-external-ref-events`, cut from an up-to-date `main` (v0.7.0), and that `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass before any change; note the size of `dist/content-sdk.js` (13,838 bytes at the time of the plan) for T025

---

## Phase 2: Foundational

**Goal**: the shapes every story uses.

- [X] T002 In `src/types.ts` add the item shape for reporting, `{ id: string; externalRef?: never } | { externalRef: string; id?: never }`, with a doc comment (an item of content-api, or something the platform does not store, named by a label it chose); do not export it from `src/index.ts` (R6). In `src/events/rules.ts` make `EventRecord` carry exactly one of `item_id` and `external_ref` as the union `{ item_id: string; external_ref?: never } | { external_ref: string; item_id?: never }` (each with the shared keys), so existing tests that read `event?.item_id` still type-check; no behaviour change. `npm run typecheck` and every existing test pass unedited

**Checkpoint**: the shapes exist; nothing is read or sent yet.

---

## Phase 3: User Story 1 - Report a view or click about something not stored (Priority: P1) 🎯 MVP

**Goal**: a valid `externalRef` reaches the sent event as `external_ref`, with no `item_id`.

**Independent test**: with a fake transport, a view and a click with `{ externalRef: "telegram:addis_news/10234" }` each send one event with `external_ref` and no `item_id`, and the options' fields as for items.

- [X] T003 [US1] Write the `tests/unit/events/rules.test.ts` additions first: `eventFor` with `{ externalRef: "telegram:addis_news/10234" }` returns an event with `external_ref` set as given, no `item_id` key (check `"item_id" in event` and `JSON.stringify`), and no warning, for `view` and `link_click`; the reference is kept as given (case, `_ . : / -`, digits, exactly 128 characters); `placementId`, `actorRef` and `sessionId` work beside it as for items; with no `placementId`, no `placement_id` key is present (R5); no `event_id` key
- [X] T004 [US1] Implement in `src/events/rules.ts` (T003): read `id` and `externalRef` of the item in one `try` (a throwing getter keeps the existing "could not be read" warning); a field is given when it is neither `undefined` nor `null` (R1); when only `externalRef` is given and valid, build the event with `external_ref` and no `item_id`; the options block is untouched; the reference pattern check of T009 lands in the same change, so no bad reference is ever sent, and the "both" and "neither" refusals are T013
- [X] T005 [P] [US1] Write the `tests/unit/events/reporter.test.ts` additions first: through `createReporter` over the fake transport, `trackLinkClick({ externalRef }, { placementId: "telegram", sessionId: "s-1" })` sends an event with `external_ref`, `placement_id`, `session_id` and no `item_id`; `watchView(element, { externalRef }, options)` sends one view once seen, by the same rule as for an item; an item event and a reference event in one batch are two events, each with its own identifying key (SC-001: 50 mixed calls, each sent event has exactly one of the two keys matching its call)
- [X] T006 [P] [US1] Write the `tests/unit/events/library.test.ts` additions first: `createLibrary(globals).trackLinkClick(target, { externalRef }, options)` and `watchView(target, element, { externalRef }, options)` send the reference event; item calls are as before
- [X] T007 [US1] Widen the item parameter of `watchView` and `trackLinkClick` in `src/events/library.ts` from `{ id: string }` to the shape of T002 (the reporter and loader take `unknown` and need no edit; check `src/loader/commands.ts` stays untouched). Run T003, T005 and T006 against T004 and T007; fix the code, not the tests, if a case fails, and check the existing library and loader tests still type-check and pass unedited

---

## Phase 4: User Story 3 - A bad reference is refused locally, once, without printing it (Priority: P1)

**Goal**: a reference the service would refuse never reaches it; one plain warning; no event; the value never printed.

**Independent test**: `externalRef` of `""`, 129 characters, `"a b"`, `"é"`, `"a\u0000b"`, `"a\n"`, `7`, `{}` each give no event and one warning without the value, and no throw.

- [X] T008 [US3] Write the `tests/unit/events/rules.test.ts` additions first: an empty text, 129 characters, a space, an accented letter, an emoji, a NUL, a trailing newline, a number, a boolean, an object, a list, a function and a symbol each give `event: undefined` and exactly one warning that starts with `[content-sdk] ` and says `externalRef` must be 1 to 128 characters of `A-Za-z0-9_.:/-` and no event was recorded; the warning never contains the value given (use a recognisable value, SC-004); a throwing `externalRef` getter gives the existing "could not be read" warning once
- [X] T009 [US3] Add the check to `src/events/rules.ts` (T008): the pattern `^[A-Za-z0-9_.:/-]{1,128}$` on a string (R3), no normalisation, warning text without the value (R4)
- [X] T010 [P] [US3] Write the `tests/unit/events/no-throw.test.ts` additions first: `watchView` and `trackLinkClick` with an item whose `externalRef` is every hostile kind (getter that throws, proxy that throws on any access, Symbol, BigInt, a huge string, a cyclic object, a frozen object) never throw or reject
- [X] T011 [US3] Write the `tests/unit/events/reporter.test.ts` additions first: a click with a bad reference sends nothing and its warning reaches the injected `warn` once; a batch where one reference event is bad and the others good is sent whole with the good ones (the bad one never enters the batch). Run T008, T010 and T011 against T009; fix the code if a case fails

---

## Phase 5: User Story 4 - An item that names both or neither is refused (Priority: P1)

**Goal**: the SDK never sends both `item_id` and `external_ref`, nor neither.

**Independent test**: `{ id: uuid, externalRef }`, `{ id: "x", externalRef }`, `{}`, `{ id: null, externalRef: null }` each give no event and one warning; `{ id: null, externalRef }` and `{ id: uuid, externalRef: null }` are reported.

- [X] T012 [US4] Write the `tests/unit/events/rules.test.ts` additions first: both given with a UUID id; both given with an `id` that is not a UUID, empty, or a number (R1: still "both"); neither (`{}`, `{ title }`, `{ id: undefined }`); both `null`; each gives `event: undefined` and exactly one warning without any value, and the "both" and "neither" warnings differ in text; `{ id: null, externalRef: valid }` gives a reference event and `{ id: uuid, externalRef: null }` an item event, each with no warning; `{ id: "abc" }` alone keeps the v0.7.0 refusal
- [X] T013 [US4] Implement in `src/events/rules.ts` (T012): after reading, both given then one warning "needs exactly one of id and externalRef, not both" and no event; neither given then the existing "needs an id that is a UUID" warning widened to name `externalRef` too (the existing tests check only the `[content-sdk] ` prefix and the count); never put both keys on an event. Run T012 against it
- [X] T014 [P] [US4] Add `tests/unit/events/types.test.ts`: a compile-time test of the library calls: `{ id }` and `{ externalRef }` compile; a `// @ts-expect-error` line each for neither (`{}`), both, `{ externalRef: 5 }`; a fetched `Item` value is assignable; put the `@ts-expect-error` calls inside a function that is never called, so they do not run; `npm run typecheck` is what proves it (SC-005), and the Jest body only asserts the valid shapes

---

## Phase 6: User Story 2 - Item events behave exactly as before (Priority: P1)

**Goal**: nothing a platform does with items today changes.

**Independent test**: every existing test passes unedited; an item event is byte for byte v0.7.0's.

- [X] T015 [US2] Write the `tests/unit/events/rules.test.ts` addition first: an item event's JSON for an item with a UUID `id` (and extra keys such as `title`, and a fetched item with `view_count`) equals v0.7.0's, with no `external_ref` key and no warning; the options warnings and their texts for `placementId`, `actorRef` and `sessionId` are as before, for item and reference events alike
- [X] T016 [US2] Run the whole existing test set (`npm test`): every test not named in a task passes with **no edit** (SC-002, FR-007); fix the code if any fails

---

## Phase 7: Browser, loader and contract

- [X] T017 [P] [US1] Add to `tests/unit/loader/commands.test.ts` the case where the queue's `trackLinkClick` and `watchView` commands pass an item with `externalRef` and the options to the reporter unchanged (no edit to `src/loader/` is expected)
- [X] T018 [US1] Add to `tests/browser/bundle.test.ts`, on the built script in jsdom (`npm run build` first): a reference event through the queue form and through the direct call is sent with `external_ref` and no `item_id`; an item event beside it is unchanged; a bad reference and a both item send nothing and print one warning each without the value
- [X] T019 [US2] Check the bundle test's existing storage, cookie and random-source spies still pass with reference events in the lifecycle (the SDK touches none)
- [X] T020 [P] Update `tests/contract/events-v1.test.ts` from content-api's `events-v1-delta` of spec 022 (read only): replace the `item_id` check on line 22 with "exactly one of `item_id` (a UUID) and `external_ref` (text matching `^[A-Za-z0-9_.:/-]{1,128}$`), `null` counting as not given"; add a reference event to the contract example and, to the refused cases, both fields, neither, an empty, a 129-character, a spaced and an accented reference; every payload the SDK builds, item, reference and mixed, passes the validator (FR-012). Existing cases stay as they are

---

## Phase 8: User Story 5 - The platform is told what to put in a reference

- [X] T021 [P] [US5] Update `README.md`, "Reporting views and clicks": the item may be `{ externalRef }`; the rule (1 to 128 characters of `A-Za-z0-9_.:/-`, case kept); the example `telegram:addis_news/10234`; both or neither is refused with a warning; that the platform must supply a stable reference made only of public identifiers (no email, name or anything that identifies a person) and must fix its format early because changing it later splits one thing's events in two; that a named `placementId` must exist and be enabled on the service or the event is dropped, and the SDK invents none; keep the link to the events contract
- [X] T022 [P] Add one line to `specs/004-view-events/contracts/events-api.md` pointing to `specs/008-external-ref-events/contracts/events-api-delta.md`
- [X] T023 [P] Update `CLAUDE.md`'s status paragraph with feature 008: what it is, built on the branch `008-external-ref-events`, the owner tags `v0.8.0` after the merge and content-api takes it in a pin-bump spec, the platform must supply a stable, public-identifiers-only reference and fix its format early, and the SDK invents no placement and no reference

---

## Phase 9: Release

- [X] T024 Set the version to `0.8.0` in `package.json` and `package-lock.json` (both places that name this package, not a dependency's) and, in the same change, edit the one existing test that pins it: `tests/unit/package.test.ts`, the test's name (line 20, "… version 0.7.0") and the assertion (line 25, `expect(pkg.version).toBe("0.7.0")`), both to `0.8.0`
- [X] T025 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; all green with no skipped test; `dist/content-sdk.js` has grown by at most 1 KB over T001's size (SC-006), and the size is recorded in `research.md`; `git diff --stat main` shows no change under `src/fetch-page.ts`, `src/events/batcher.ts`, `src/events/transport.ts`, `src/events/watch.ts` or `src/loader/` (FR-008)
- [X] T026 Walk `quickstart.md` steps 1 and 2; run the mutation check: remove the line that sets `external_ref` (and, separately, the "both" refusal) and the matching tests must fail
- [X] T027 Record in `research.md` every approach started and then rejected or reversed during the build (or state that there was none)

---

## Dependencies and order

- T001, then T002. T003, T005 and T006 (tests) can be written in parallel after T002; T004 follows T003; T007 follows T004 and runs them.
- Phases 4 and 5 extend the same function as Phase 3 (`rules.ts`), so T008, T009, T012, T013 run in that order after T007; T010 and T014 are in other files and can be written in parallel. `tests/unit/events/reporter.test.ts` is shared by T005, T011 (not `[P]` with each other) and `rules.test.ts` by T003, T008, T012, T015.
- Phase 6 needs Phases 3 to 5 and should need no new production code.
- Phase 7: T017 and T020 in parallel; T018 needs a build. Phase 8 tasks are documents in different files and run in parallel after the stories. Phase 9 last.

## Implementation strategy

MVP is Phases 1 to 3: a valid reference is sent. Phases 4 and 5 add the refusal-first protection of the batch (they ship together; a reference sent without them could refuse a whole batch). Phase 6 is the compatibility proof; Phase 8 is the guidance the spec requires.

## Hosted checks (the owner's, not part of this change)

- The owner tags `v0.8.0` on the merge commit, and a later content-api spec takes the tag (a pin bump, as specs 013, 015, 018 and 021 did); nothing is tagged or published by this change.
- The owner creates the `telegram` placement for `listings` on the hosted service; until then the service drops those events with its usual 204.
- After content-api serves `0.8.0`, a click reported from listings with an `externalRef` has it in the Neon row (quickstart step 3).
