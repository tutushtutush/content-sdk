# Implementation Plan: Report Views and Link Clicks

**Branch**: `004-view-events` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-view-events/spec.md`

## Summary

Add two calls the platform makes, `watchView(element, item, options?)` and `trackLinkClick(item, options?)`, on `window.contentSdk`, on the queue, and as library exports. A watch uses an `IntersectionObserver` to decide that an item was seen (50% visible for one continuous second, once, giving up after two minutes) and queues a `view`; a click queues a `link_click`. A batcher sends the waiting events as one `text/plain` request to content-api's `POST /api/v1/events` about two seconds after the first, at once at 50, and when the page is hidden, by beacon with a keep-alive `fetch` fallback, never retried. The item id, placement id and actor reference are checked against the service's own rules before they are queued, so one wrong value cannot cost the good events beside it. No runtime dependency, no DOM created, no cookie or storage, never throws. Version 0.4.0. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: none

**Testing**: Jest: unit tests of each new module with fakes for the clock, timers, observer, beacon and fetch; the loader's unit tests; the jsdom test of the built script with a fake observer; a contract test against the rules of content-api's events contract

**Target Platform**: current browsers (script tag) and Node 22 (library; `watchView` is inert there)

**Project Type**: library (unchanged)

**Performance Goals**: none; one observer per watch, one timer per batch; a watch lets everything go when it ends

**Constraints**: never throws or rejects into the page; no runtime dependency; no cookie, storage, element, style or listener created on the page; at most 50 events per request; every existing behavior unchanged (the existing tests pass untouched)

**Scale/Scope**: five small modules and two loader methods; about 300 lines of code, and the tests

## Constitution Check

| Principle | Status |
|---|---|
| I Headless | the SDK creates nothing on the page; it only observes an element it was handed and sends ids; click detection is the platform's |
| II Untrusted input | nothing received is used: the answer to an event is never read; the platform's arguments are validated before use |
| III No runtime dependencies | none added; only `IntersectionObserver`, `navigator.sendBeacon`, `fetch` and timers the browser provides |
| IV Contract-first | `contracts/events-api.md` documents the public API; a contract test runs every payload through the rules of content-api's events contract |
| V Clean, testable | clock, timers, observer, beacon, fetch and the hidden-page signal are injected; structural types only (no DOM library) |
| VI Small surface | two calls and two options; a generic `reportEvent`, a tag attribute, retries and deduplication are left out and listed |

No deviation. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/004-view-events/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/events-api.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── events/                      # NEW
│   ├── constants.ts             # FLUSH_DELAY_MS, BATCH_MAX, DWELL_MS, VISIBLE_RATIO, GIVE_UP_MS
│   ├── env.ts                   # ReportEnv: structural types for clock, timers, observer, beacon, fetch, page-hidden signal
│   ├── rules.ts                 # item id (UUID), placementId, actorRef checks; build one event
│   ├── batcher.ts               # queue, flush policy (2 s, 50, page hidden), calls the transport
│   ├── transport.ts             # events address, body, beacon then keep-alive fetch, never throws
│   ├── watch.ts                 # one viewability watch: observer, dwell timer, give-up timer, stop
│   ├── reporter.ts              # createReporter(target, env): watchView, trackLinkClick, over one batcher
│   ├── page-env.ts              # pageEnv(page): builds the ReportEnv from the page's globals; the one module that reads the page
│   └── library.ts               # createLibrary(page): the library form, one reporter per target
├── request.ts                   # the base-address check moves into one shared helper (no behavior change)
├── types.ts                     # + ReportTarget, ViewOptions
├── index.ts                     # + export watchView, trackLinkClick (made by createLibrary over the page's globals)
└── loader/
    ├── env.ts                   # Env grows the optional page members the reporter needs
    ├── commands.ts              # + makeWatchView, makeTrackLinkClick (tag settings plus the call)
    └── install.ts               # offers the two methods and accepts them on the queue

tests/
├── unit/events/                 # rules, batcher, transport, watch, reporter, page-env, library, no-throw (helpers.ts: fake clock, observer, beacon)
├── unit/loader/                 # commands and install: the two methods and the queue form
├── unit/                        # request.test.ts unchanged (shared helper proof); no-throw additions; package test (0.4.0)
├── browser/bundle.test.ts       # the built script offers the methods and reports through a fake observer
└── contract/events-v1.test.ts   # payloads against the rules of the service's events contract

package.json, package-lock.json  # version 0.4.0
README.md, CLAUDE.md             # the new section and the status
```

**Structure Decision**: a new `src/events/` folder beside the delivery client, and two page-facing methods in the existing loader. The library exports the same two functions with a target first.

## Design

- **Rules** (`rules.ts`): `eventFor(kind, item, options, now)` returns the event or a list of warnings: the item must be a record with a UUID `id` (otherwise no event); `placementId` and `actorRef` are kept only when valid (otherwise left out, one warning each). The time is `new Date(now()).toISOString()`.
- **Batcher** (`batcher.ts`): `add(event)` pushes and, at 50, flushes at once; otherwise starts the two-second timer when the queue was empty. `flush()` cancels the timer, takes the queue (never more than 50) and hands it to the transport; an empty queue does nothing. `pageHidden()` flushes. All of it behind the injected clock and timers.
- **Transport** (`transport.ts`): builds `{baseUrl}/api/v1/events` with the shared base check (an unusable base is one warning once, and nothing is sent), the body, and sends beacon then fetch (research R6). It never throws and never awaits the answer.
- **Watch** (`watch.ts`): the observer with threshold 0.5, the dwell timer, the give-up timer, `stop` (research R5). Ends by releasing the observer and timers.
- **Reporter** (`reporter.ts`): one per target. `watchView(element, item, options)` validates the element and item, builds the event on completion, and returns `stop`; `trackLinkClick(item, options)` queues at once. It listens for the page being hidden once, when the first event is queued, through the injected signal.
- **Loader** (`commands.ts`, `install.ts`): the two methods use the tag's settings, the real globals as the environment, and are added to the runner's command map, so the queue accepts them. A missing tag setting leaves them absent, as `fetchPage` is.
- **Library** (`library.ts`, exported by `index.ts`): a small map from target (`baseUrl` plus `platformId`) to its reporter, created on first use from the page's globals through `page-env.ts`. `page-env.ts` is in `events/`, not `loader/`, because the library needs it and nothing under `loader/` may appear in the package's declarations (research R15).

## Risks and how they are covered

- **A wrong value costs a batch**: rules refuse it before queueing (R4), with a unit test for each rule and a contract test over every built payload.
- **A leak of elements or timers**: each watch ends on report, stop or give-up, and a test checks nothing is left observing or scheduled.
- **A throw into the page**: every entry point and callback is wrapped (R11); the no-throw tests feed bad arguments, a throwing observer, beacon, fetch and console.
- **The beacon's console message** (R7): not testable here; the owner's step in a real browser records it and decides the follow-up.
- **No change to the existing behavior**: the existing tests run unchanged; the shared base check has no new behavior.

## Complexity Tracking

None.
