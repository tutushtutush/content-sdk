# Tasks: Report Views and Link Clicks

**Input**: Design documents from `/specs/004-view-events/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1 to R15), [data-model.md](data-model.md), [contracts/events-api.md](contracts/events-api.md), [quickstart.md](quickstart.md)

**Tests**: included (constitution V). Write each test before the code it checks and see it fail. Clock, timers, observer, beacon, fetch and the page-hidden signal are always injected fakes in unit tests.

**Rules for every task**: no runtime dependency; no element, style, attribute, listener (other than the page-hidden signal) or cookie or storage created on the page; nothing throws or rejects into the page (FR-010); never more than 50 events in a request; the content-api contract files are read only; every existing test passes unchanged (SC-005). Nothing is tagged, pushed, merged or published without the owner's go-ahead.

## Format: `[ID] [P?] [Story] Description`

Markers: `[ ]` open, `[X]` done. **[P]** can run in parallel (different files, no dependency on an open task). Stories: US1 a platform reports views, US2 a platform reports a followed link, US3 reporting never gets in the page's way, US4 the platform says where and who, US5 a bad call never breaks the page.

---

## Phase 1: Setup

- [X] T001 Confirm the branch is `004-view-events` and that `npm run lint`, `npm run typecheck` and `npm test` pass before any change

---

## Phase 2: Foundational

**Goal**: the pieces every story uses: the constants and types, the event rules, the transport and the batcher.

- [X] T002 [P] Write `tests/unit/events/rules.test.ts` first (research R4): `eventFor(kind, item, options, now)` returns an event with `kind`, `item_id` (the item's `id` as given), and `occurred_at` as `new Date(now).toISOString()`; an item that is not an object, has no `id`, or whose `id` is not a UUID (not text, empty, a number, uppercase-or-lowercase UUIDs both accepted) gives no event and one warning; `placementId` is kept when 3 to 40 characters of `a-z`, `0-9`, `-` and left out, with one warning, when empty, 2 or 41 characters, upper-case, containing a space, or not text; `actorRef` is kept when 1 to 128 characters (counted as characters, so 128 emoji pass and 129 do not) and left out, with one warning, when empty, over 128, containing NUL, or not text; options that are `undefined` are fine, options that are not an object (a string, a number, an array) give one warning and are ignored; unknown option keys are ignored; the event has no `placement_id` or `actor_ref` key when none is kept
- [X] T003 Create `src/events/constants.ts` (`FLUSH_DELAY_MS = 2000`, `BATCH_MAX = 50`, `DWELL_MS = 1000`, `VISIBLE_RATIO = 0.5`, `GIVE_UP_MS = 120000`), `src/events/env.ts` (`ReportEnv`: structural types for a clock, set and clear timer, the observer constructor, `sendBeacon`, `fetch`, the page-hidden subscription and a console, with no DOM library types), `ViewOptions` and `ReportTarget` in `src/types.ts` (doc comments), and `src/events/rules.ts` (T002): one small named function with no environment knowledge
- [X] T004 [P] Write `tests/unit/events/transport.test.ts` first (research R6, R12): the address is `{baseUrl}/api/v1/events` (a base with a trailing slash gives one slash; a base with a path keeps it); an unusable base (not http or https, with a query or fragment, empty) sends nothing and gives one warning, once; the body is `JSON.stringify({ platform_id, events })`; the beacon is tried first with that string; when the beacon is missing, returns `false` or throws, one keep-alive `fetch` follows with `method: "POST"`, the same body, `keepalive: true`, `credentials: "omit"` and `content-type: text/plain;charset=UTF-8`; when the beacon returns `true` no `fetch` is made; a `fetch` that throws or rejects is swallowed; neither being available is one warning; nothing is retried; nothing is awaited by the caller; the send never throws
- [X] T005 Move the base-address checks of `buildRequestUrl` in `src/request.ts` into one shared helper (no behavior change: the existing `tests/unit/request.test.ts`, `fetch-page.test.ts` and `paging.test.ts` pass unedited) and create `src/events/transport.ts` (T004) using it; the transport never throws and never reads an answer
- [X] T006 [P] Write `tests/unit/events/batcher.test.ts` first (research R3), with a fake clock and timers: the first event starts one timer of 2000 ms; events added meanwhile join the same batch; at 2000 ms all go in one call; the 50th event flushes at once and cancels the timer; a flush never hands over more than 50, and 120 events added in a row give calls of 50, 50 and 20 in the right order with the 20 waiting for its own timer; `flush()` on an empty queue does nothing; a page-hidden call flushes at once and cancels the timer; an event added while a flush is running joins the next batch; after a flush the next event starts a new timer; a transport that throws leaves the queue empty and the next event still works; no timer is left running after a flush
- [X] T007 Create `src/events/batcher.ts` (T006): `add`, `flush`, `pageHidden` over the injected clock, timers and a `send(batch)` function

**Checkpoint**: rules, transport and batcher are tested with fakes and the old tests are green.

---

## Phase 3: User Story 1 - A platform reports the items its visitors have seen (Priority: P1)

**Goal**: `watchView` queues one `view` when an element has been half visible for one continuous second.

**Independent Test**: with a fake observer and a fake clock, 60% visible for 1000 ms gives one `view`; 40%, 900 ms, or 600 ms then hidden gives none.

- [X] T008 [P] [US1] Write `tests/unit/events/watch.test.ts` first (research R5): the observer is made with a threshold of 0.5 and given the element; an entry at 0.6 starts the 1000 ms timer and at 999 ms nothing is reported, at 1000 ms one report; an entry at 0.4, or not intersecting, never starts it; 0.6 then 0.3 at 600 ms cancels it, and a later 0.6 starts the dwell over (a report only 1000 ms after the second start); two entries in a row at 0.6 do not restart the timer; one report only, however long it stays visible; after a report the observer is disconnected and no timer is left; with no entry for 120000 ms the watch gives up, disconnects and reports nothing; a dwell started at 119500 ms is cut off by the give-up at 120000 ms and reports nothing; the page-hidden signal arriving in the middle of a dwell (the visitor leaves before the second has passed) reports nothing; `stop` before the report cancels both timers and disconnects, a second `stop` and `stop` after the report do nothing; no observer constructor, or one that throws, gives a watch that does nothing with a `stop` that does nothing and no throw; an observer callback that throws is caught
- [X] T009 [US1] Create `src/events/watch.ts` (T008): one viewability watch over the injected observer constructor and timers; ends by releasing the observer and every timer
- [X] T010 [P] [US1] Write the `watchView` cases of `tests/unit/events/reporter.test.ts` first: with a good element and item it observes the element, and when the dwell completes one `view` event is added to the batcher with the item's id and the time at completion; an element that is missing, `null` or not an object gives one warning, no watch and a `stop` that does nothing; an item that fails the rules gives one warning and no watch; the returned `stop` cancels the watch so nothing is reported; two calls for one element are two watches
- [X] T011 [US1] Create `src/events/reporter.ts` (T010): `createReporter(target, env)` with `watchView(element, item, options)`, built over the rules, the watch, the batcher and the transport

**Checkpoint**: US1 works end to end with fakes.

---

## Phase 4: User Story 2 - A platform reports a followed link (Priority: P1)

**Goal**: `trackLinkClick` queues one `link_click` per call and adds no click listener of its own.

**Independent Test**: one call gives one `link_click` with the item's id; two calls give two.

- [X] T012 [P] [US2] Add the `trackLinkClick` cases to `tests/unit/events/reporter.test.ts` first: a good item queues one `link_click` with its id and the time of the call; two calls queue two events (no deduplication); an item that fails the rules gives one warning and no event; no click listener and no listener on any element is added by the call: the fake environment records every subscription, and the only one it may see is the single page-hidden subscription made when the first event is queued, never one per call
- [X] T013 [US2] Add `trackLinkClick(item, options)` to `src/events/reporter.ts` (T012)

---

## Phase 5: User Story 3 - Reporting never gets in the page's way (Priority: P1)

**Goal**: events leave together, never more than 50, on the right signals, without a retry or a throw.

**Independent Test**: 3 events wait about two seconds and leave in one request; the 50th leaves at once; a hidden page flushes the rest; a failing transport leaves the page and later events unaffected.

- [X] T014 [US3] Write the end-to-end cases in `tests/unit/events/reporter.test.ts` first, with the real batcher and transport over fakes: a view and a click queued within two seconds leave in one beacon of two events after 2000 ms; 50 events leave at once in one request and a 51st starts a new wait; the page-hidden signal flushes waiting events, through both the window's `pagehide` and the document's `visibilitychange` when it reads `hidden` (and `visibilitychange` while `visible` does nothing); both signals together send once, not twice; no request is made when nothing waits, however often the page is hidden; the page-hidden subscription is made once, when the first event is queued, and not before; a beacon that fails and a `fetch` that rejects are never retried and the next event is still sent; the body and address are those of `contracts/events-api.md`. Fix whatever it finds in `src/events/batcher.ts`, `transport.ts` or `reporter.ts`

---

## Phase 6: User Story 4 - The platform says where and, optionally, who (Priority: P2)

**Goal**: `placementId` and `actorRef` are sent exactly when given and valid, and every payload meets the service's contract.

**Independent Test**: events carry `placement_id` and `actor_ref` exactly when given and valid; every payload passes a validator written from the service's contract.

- [X] T015 [US4] Write `tests/contract/events-v1.test.ts` first (constitution IV, research R13): a validator written from the rules of content-api's `events-v1` (the body is an object with `platform_id` text and `events` of 1 to 50 events; each has a UUID `item_id`, a `kind` of 1 to 32 characters of `a-z`, `0-9`, `_`, `-`, and when present a `placement_id` of 3 to 40 characters of `a-z`, `0-9`, `-`, an `actor_ref` of 1 to 128 characters and an `occurred_at` that is ISO 8601 with a zone); the validator itself is checked against good and bad examples; then every payload the reporter sends is run through it: a view, a click, both options given, neither given, an invalid option left out, 50 events, and the example payload of the contract; a payload with a non-UUID id is never sent. Through the reporter, check that `placement_id` and `actor_ref` appear exactly when given and valid. Fix whatever it finds in `src/events/rules.ts` or `reporter.ts`

---

## Phase 7: User Story 5 - A bad call or a failing page never breaks the host page (Priority: P2)

**Goal**: the two methods are on `window.contentSdk`, on the queue and in the library, and nothing throws.

**Independent Test**: bad arguments, a throwing observer, beacon, fetch or console each give no exception and at most one warning; a queued call before load runs in order after it.

- [X] T016 [P] [US5] Write the loader cases first in `tests/unit/loader/commands.test.ts` and `tests/unit/loader/install.test.ts`: `makeWatchView` and `makeTrackLinkClick` use the tag's base address and platform id with the call's arguments; after `install` with good settings `contentSdk.watchView` and `contentSdk.trackLinkClick` exist beside `fetchPage`; the queue forms `["watchView", element, item, options]` and `["trackLinkClick", item, options]` pushed before load run in order after it (with a `fetchPage` entry between them), and a queued `watchView` returns nothing to the page; entries pushed after load run at once; with missing settings neither method exists and nothing is replayed (as `fetchPage`); a second load changes nothing; the existing install and commands tests pass unedited
- [X] T017 [US5] Add the optional page members the reporter needs to `src/loader/env.ts`, add `makeWatchView` and `makeTrackLinkClick` to `src/loader/commands.ts`, and offer them in `src/loader/install.ts` and the runner's command map (T016); the real globals are the environment
- [X] T018 [P] [US5] Write `tests/unit/events/no-throw.test.ts` first (SC-003): with a fake page, every combination of no element, `null`, a number, no item, an item with no id or a non-UUID id, options that are a string, a number, an array or an object with throwing getters, a missing observer, an observer constructor that throws, an observer callback that throws, a beacon that throws, a `fetch` that throws and one that rejects, a timer function that throws, and a console whose `warn` throws, gives no exception and no rejected promise, and at most one warning per bad call; a watch given a throwing getter on the item's `id` is refused with one warning
- [X] T019 [US5] Add `watchView(target, element, item, options?)` and `trackLinkClick(target, item, options?)` to `src/index.ts` over a small registry of one reporter per target (`baseUrl` plus `platformId`), created on first use with the real globals; add the cases to `tests/unit/entries.test.ts` (the exports exist, the same target reuses its reporter, a different one does not, an unusable target is one warning and no throw) and check in `tests/unit/headless.test.ts` that no DOM library type or element creation was added; in Node (no observer) `watchView` is inert and `trackLinkClick` still queues
- [X] T020 [US5] Add the cases to `tests/browser/bundle.test.ts` (jsdom, the built script, a fake `IntersectionObserver`, a fake `sendBeacon`, fake timers): after the script loads, `contentSdk.watchView` and `trackLinkClick` exist; a queued `watchView` and `trackLinkClick` run after load; a card made visible for one second leads, two seconds later, to one beacon to `/api/v1/events` with a `text/plain` string body whose parsed content has the tag's `platform_id` and the events; no request of any kind is made by the script until an event is reported (loading it, and calling `fetchPage` aside); the page's cookies, `localStorage` and `sessionStorage` are untouched and no element was added or changed on the page by the SDK; the built file is still one minified script with a source map

---

## Phase 8: Polish and cross-cutting

- [X] T021 Set the version to `0.4.0` in `package.json` and `package-lock.json` (FR-013) and update `tests/unit/package.test.ts` if it pins the version
- [X] T022 [P] Update `README.md` (a "Reporting views and clicks" section: the two calls, the options, what a view is, when events leave, what is not stored, the queue form, the library form, and that the SDK never retries) and `CLAUDE.md` (status: feature 004 built on the branch `004-view-events`, version 0.4.0, content-api serves it only after its pinned tag moves)
- [X] T023 Run `npm run build` and record the size of `dist/content-sdk.js` before and after in `research.md` and check the growth is at most 5 KiB, 5,120 bytes (SC-005); run `npm run lint`, `npm run typecheck` and `npm test` twice more for stability; `git diff main --stat -- tests` and confirm only additions and the named edits (`entries.test.ts`, `headless.test.ts`, `package.test.ts`, `bundle.test.ts`, the loader tests) changed; update `research.md` R15 with the final state (say none if none)
- [ ] T024 GATED: the owner decides when to push, open the pull request and merge. Put in the pull request text: additive, version 0.4.0, no runtime dependency, nothing stored on the page, and that content-api serves it only after a tag and its own pin change (a separate feature)
- [ ] T025 GATED: after the tag and the pin change are deployed, the owner runs the quickstart's by-hand steps in a real browser against the hosted test service, and records whether the beacon prints a CORS message about credentials in the console (research R7), so the follow-up decision can be made. The assistant never asks for a key or a connection string

---

## Dependencies and order

- Phase 1, then Phase 2. In Phase 2: T002 before T003; T004 before T005; T006 before T007; the three test-code pairs touch different files and can be written together (T002, T004 and T006).
- Phase 3 needs Phase 2. T008 and T010 are tests (different files) before T009 and T011; T011 needs T009. Phase 4 extends the same reporter and its test file, after T011. Phase 5 follows Phase 4 and fixes what it finds.
- Phase 6 needs Phases 3 and 4. Phase 7: T016 and T018 are tests (different files) that can be written with T015; T017 needs T011 and T013; T019 needs T011 and T013; T020 needs T017 and the build. Phase 8 follows. T024 and T025 are the owner's.

### Parallel examples

- T002, T004 and T006 touch different files.
- T008 and T010 touch different files.
- T016 and T018 touch different files.

## Implementation strategy

MVP is Phases 1 to 4: a platform can report views and clicks through the reporter. Phase 5 proves the sending rules, Phase 6 the contract with the service, Phase 7 the page-facing surface and the no-throw guarantee, and Phase 8 documents and versions it. One pull request, built and shown, and nothing pushed until the owner says so.

---

## Phase 9: Convergence

- [X] T026 Update the "Source Code" tree and the Design section of `specs/004-view-events/plan.md` to match what was built: `src/events/page-env.ts` (the one module that reads the page's globals, with its test), `src/events/library.ts` (the library form with one reporter per target; `src/index.ts` only exports from it), and `tests/unit/events/page-env.test.ts` and `library.test.ts`, per plan: structure (unrequested)
- [X] T027 GATED (owner's decision, 2026-11-17: option 1, read as 5 KiB; the spec now says so and the code stays): settle SC-005's reading, since the built file grew by 5,066 bytes. Either say "5 KiB (5,120 bytes)" in the spec and keep the code, or shorten the console warnings in `src/events/` to bring the growth under 5,000 bytes and re-measure in `research.md` R16, per SC-005 (partial)
