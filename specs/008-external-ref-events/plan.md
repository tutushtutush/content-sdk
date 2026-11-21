# Implementation Plan: Report Events About Things That Are Not Items (External Reference)

**Branch**: `008-external-ref-events` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-external-ref-events/spec.md`

## Summary

`watchView` and `trackLinkClick` accept, in place of an item with an `id`, an object with an `externalRef`. The event builder (`src/events/rules.ts`) decides which of the two the item names, refuses both and neither, checks the service's rule for a reference (1 to 128 characters of `A-Za-z0-9_.:/-`), and puts `external_ref` on the event instead of `item_id`. A bad or ambiguous item records no event and gives one warning that never holds the value. The options, batcher, transport, view rule, click rule and loader (which hands items and options straight to the reporter) are untouched. The item parameter of the typed library calls becomes a union so a call with neither fails to compile. Version `0.8.0`; README, the events contract and CLAUDE.md move with it (research R1 to R7).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: none

**Testing**: Jest: unit tests of the rule with plain values; reporter, library and loader unit tests; a type test (compile-time) for "neither fails"; the jsdom test of the built script; the contract test against the service's delta; the live test is the owner's

**Target Platform**: current browsers (script tag) and Node 22 (library)

**Project Type**: library (unchanged)

**Performance Goals**: none; no new timer, listener or allocation beyond one regular expression test

**Constraints**: never throws or rejects into the page; no runtime dependency; item events byte for byte as v0.7.0; the built script grows by at most 1 KB (SC-006; `dist/content-sdk.js` is 13,838 bytes minified now, about 0.4 KB expected)

**Scale/Scope**: one function reshaped, one type added, two documents plus README and CLAUDE.md, and the tests; about 40 lines of code

## Constitution Check

| Principle | Status |
|---|---|
| I Headless: data only | passes the platform's label through; the SDK looks nothing up, renders nothing, and keeps nothing |
| II Untrusted input | the item comes from the platform, not the network; the reference is validated before use and never printed |
| III No runtime dependencies | none added |
| IV Contract-first | `contracts/events-api-delta.md` documents the call first; the contract test runs every payload through the service's rules for `external_ref` and "exactly one of" |
| V Clean, testable | the builder stays a pure function tested with plain values |
| VI Small, honest surface | no new option, setting, export or tag attribute; the existing item parameter accepts a second shape (R2, R6). No allowed-prefix rule, no placement invented |

No violations. Complexity Tracking is empty. **Re-check after design**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/008-external-ref-events/
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
├── types.ts                         # the item shape for reporting (id or externalRef); not exported from the package
├── events/rules.ts                  # EventRecord: item_id or external_ref; eventFor decides, checks, warns
└── events/library.ts                # item parameter of watchView and trackLinkClick: the union
tests/
├── unit/events/rules.test.ts        # reference events; invalid references; both; neither; null; no value in warnings
├── unit/events/reporter.test.ts     # a reference reaches the transport for a view and a click, beside item events
├── unit/events/library.test.ts      # the typed calls accept both shapes
├── unit/events/types.test.ts        # compile-time: neither fails (a @ts-expect-error line)
├── unit/loader/commands.test.ts     # the queue form passes a reference
├── unit/events/no-throw.test.ts     # hostile externalRef values never throw
├── contract/events-v1.test.ts       # the validator learns external_ref and "exactly one of" (line 22 changes, named in tasks)
└── browser/bundle.test.ts           # the built script sends a reference event
package.json, package-lock.json      # version 0.8.0
README.md                            # "Reporting views and clicks": the shape, the rule, the privacy and format advice
CLAUDE.md                            # status: feature 008
specs/004-view-events/contracts/events-api.md  # a pointer to the delta
```

**Structure Decision**: the existing single-project layout; no new module. The reference check sits beside the id check in `rules.ts`.

## Complexity Tracking

None.
