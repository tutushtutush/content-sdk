# Implementation Plan: Send the Platform's Own Key for an Event (eventId)

**Branch**: `009-event-id` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-event-id/spec.md`

## Summary

`watchView` and `trackLinkClick` accept an optional `eventId` in their options, beside `placementId`, `actorRef` and `sessionId`. The event builder (`src/events/rules.ts`) reads it the way it reads `sessionId`, checks the rule the service checks (1 to 128 characters of `A-Za-z0-9_.:-`, `null` is absent), and puts it on the event, item or reference, as `event_id`; an invalid one is left out with one plain warning that never shows the value, and the event is still sent without a key (owner, 2026-11-21). The SDK makes, stores and remembers no key, and skips no repeated call. The batcher, transport, view rule, click rule and loader are untouched. The version becomes `0.9.0`; the README, the events contract and CLAUDE.md move with it, and the guidance on choosing a key is the point of User Story 5 (research R1 to R7).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: none (and the point of User Story 4)

**Testing**: Jest: unit tests of the rule with plain values; reporter, library and loader unit tests; the jsdom test of the built script; the contract test against the service's delta; the live test is the owner's

**Target Platform**: current browsers (script tag) and Node 22 (library)

**Project Type**: library (unchanged)

**Performance Goals**: none; one regular expression test per event that carries a key

**Constraints**: never throws or rejects into the page; no runtime dependency; no cookie, storage or random source; item and reference events byte for byte as v0.8.0 when no `eventId` is given; the built script grows by at most 1 KB (SC-006; `dist/content-sdk.js` is 14,295 bytes now, about 0.3 KB expected)

**Scale/Scope**: one function extended, one type extended, documents and tests; about 15 lines of code

## Constitution Check

| Principle | Status |
|---|---|
| I Headless: data only | the key is the platform's, for one call's event; the SDK makes, stores and remembers nothing, and skips no call (R3, R4) |
| II Untrusted input | the value comes from the platform, not the network; validated before use, never printed |
| III No runtime dependencies | none added; no `crypto`, storage or cookie |
| IV Contract-first | `contracts/events-api-delta.md` documents the option first; the contract test runs every payload through the service's rule for `event_id` |
| V Clean, testable | no new collaborator; the builder stays a pure function tested with plain values |
| VI Small, honest surface | one option, needed by the service's stored key; no default, no generated key, no memory, no setting (R2 to R4) |

No violations. Complexity Tracking is empty. **Re-check after design**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/009-event-id/
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
├── types.ts                         # ViewOptions.eventId (documented)
└── events/rules.ts                  # EventRecord.event_id; read, check and set it like sessionId
tests/
├── unit/events/rules.test.ts        # the rule: valid, absent, null, invalid, getter that throws, no value in warnings, item and reference
├── unit/events/reporter.test.ts     # the key reaches the transport for a click and a view; calls are independent; a repeat without a key is sent twice
├── unit/events/library.test.ts      # the typed calls pass it
├── unit/events/no-throw.test.ts     # a hostile eventId never throws
├── unit/loader/commands.test.ts     # the queue form passes it
├── contract/events-v1.test.ts       # the validator learns event_id; payloads with and without
└── browser/bundle.test.ts           # the built script sends it; storage, cookies and random sources untouched
package.json, package-lock.json      # version 0.9.0
README.md                            # "Reporting views and clicks": the option and how to choose a key
CLAUDE.md                            # status: feature 009
specs/004-view-events/contracts/events-api.md  # a pointer to the delta
tests/unit/package.test.ts           # the version pin (named lines in tasks)
```

**Structure Decision**: the existing single-project layout; no new module. The key check sits beside the `sessionId` check in `rules.ts`, with its own pattern.

## Complexity Tracking

None.
