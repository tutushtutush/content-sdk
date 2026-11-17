# Implementation Plan: Report the Visit with a Session Id

**Branch**: `005-session-id` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-session-id/spec.md`

## Summary

`watchView` and `trackLinkClick` accept an optional `sessionId` in their options, beside `placementId` and `actorRef`. The event builder (`src/events/rules.ts`) reads it the way it reads `actorRef`, checks the rule the service checks (1 to 128 characters, no NUL, `null` is absent), and puts it on the event as `session_id`; an invalid one is left out with one plain warning and the event is still reported. The SDK generates, stores and defaults nothing: the value is the platform's, for that call's event only. Nothing else in reporting changes: the batcher, the transport, the view rule, the click rule and the loader (which already hands the options straight to the reporter) are untouched. The version becomes `0.5.0`, the README and the events contract are updated, and the contract test learns `session_id` (research R1 to R8).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: none (and the point of User Story 4: none is read or written)

**Testing**: Jest: unit tests of the rule with plain values; the reporter and loader unit tests; the jsdom test of the built script; the contract test of the events payload; the live test is the owner's

**Target Platform**: current browsers (script tag) and Node 22 (library)

**Project Type**: library (unchanged)

**Performance Goals**: none; no new timer, listener or allocation per call beyond one string

**Constraints**: never throws or rejects into the page; no runtime dependency; no cookie, storage or random source used for the id; every existing behaviour unchanged; the built script grows by at most 1 KB (SC-006; the current `dist/content-sdk.js` is 13,146 bytes minified, so this plan expects about 0.2 KB)

**Scale/Scope**: one function extended, one type extended, two documents and the tests; about 25 lines of code

## Constitution Check

| Principle | Status |
|---|---|
| I Headless: data only | the SDK creates nothing and owns no event data beyond what it passes through: the id is the platform's and applies to one call's event (a generated default was left out for this reason, R2) |
| II Untrusted input | the value comes from the platform, not the network; it is validated before use and never printed |
| III No runtime dependencies | none added; no `crypto`, storage or cookie |
| IV Contract-first | `contracts/events-api-delta.md` documents the option first; the contract test runs every payload through the service's rules including `session_id` |
| V Clean, testable | no new collaborator; the builder is a pure function tested with plain values, as before |
| VI Small, honest surface | one option, needed by content-api's stored field; no default, no `eventId`, no global setting, no tag attribute (R2, R3) |

No violations. Complexity Tracking is empty. **Re-check after design**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/005-session-id/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── events-api-delta.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types.ts                         # ViewOptions.sessionId (documented)
└── events/rules.ts                  # EventRecord.session_id; read, check and set it like actorRef
tests/
├── unit/events/rules.test.ts        # the rule, absent, null, invalid, getter that throws, no value in warnings
├── unit/events/reporter.test.ts     # the id reaches the transport for a click and for a view; calls are independent
├── unit/loader/commands.test.ts     # the queue form passes it
├── unit/events/no-throw.test.ts     # a hostile sessionId never throws
├── contract/events-v1.test.ts       # the validator learns session_id; payloads with and without
└── browser/bundle.test.ts           # the built script sends it; storage, cookies and random sources untouched
package.json, package-lock.json      # version 0.5.0
README.md                            # "Reporting views and clicks": the option, the privacy advice
specs/004-view-events/contracts/events-api.md  # a pointer to the delta
```

**Structure Decision**: the existing single-project layout; one function and one type are edited. No new module: the check is the same shape as `actorRef`'s, a few lines beside it.

## Complexity Tracking

None.
