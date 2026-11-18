# Implementation Plan: Item View Count

**Branch**: `007-item-view-count` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-item-view-count/spec.md`

## Summary

The item the SDK returns gains `view_count: number`. The validator reads it from each delivered item as it reads `url` and the other fields: it must be a whole number of 0 or more within the safe-integer range, or the whole page is refused as `contract_mismatch` (no partial page). It is not defaulted and not optional (owner decision, option A). The result is still built field by field, so nothing else the service sends reaches it. Nothing changes in the request, the error kinds, the loader or the events. The version goes from 0.6.0 to 0.7.0 and the README documents the field. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: N/A

**Testing**: Jest: unit tests of the validator and `fetchPage` with a fake network function, the no-throw tests, the loader's unit tests and the jsdom test of the built script (all of which already build items from one shared fixture), and a contract test against content-api's delivery delta (read only)

**Target Platform**: current browsers (script tag) and Node 22

**Project Type**: library (unchanged)

**Performance Goals**: none; one more field and one number check per item

**Constraints**: never throws or rejects into the page; no runtime dependency; no new error kind or option; the request address of every call is unchanged; a page is refused whole, never partly

**Scale/Scope**: one field, one check, one version bump; about 10 lines of code, a fixture change and the tests

## Constitution Check

| Principle | Status |
|---|---|
| I Headless | passes the service's number on; no formatting, no display, no arithmetic |
| II Untrusted | the value is validated like every other field and the result is built field by field; a number that cannot be a count refuses the page with a typed error, never a thrown surprise |
| III No runtime dependencies | none added; `Number.isSafeInteger` only |
| IV Contract-first, versioned | follows content-api's `delivery-v1-delta` of spec 019 (read only, tested in `tests/contract`); the public type gains a field, documented in `contracts/item-view-count.md` and the README, and the version rises by one minor step |
| V Clean, testable | the check is one small function with unit tests; the network stays injected |
| VI Small surface | one field the contract states and a platform needs; no helper, no formatter, no default |

No deviation. One cost is stated, not hidden: the exported `Item` type requires the field, so code that builds items by hand needs it (research R6). Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/007-item-view-count/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/item-view-count.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types.ts             # Item gains `view_count: number`
└── validate.ts          # read, check and return view_count (one small function, beside parseImage)

tests/
├── contract/fixtures/delivery-v1.ts   # exampleItem gains view_count, as the service's example does
├── contract/delivery-v1.test.ts       # the item example carries it
├── contract/item-view-count.test.ts   # new: the rules of content-api's delivery delta
├── unit/validate.test.ts              # good counts, bad counts, whole page refused
├── unit/fetch-page.test.ts, no-throw.test.ts, loader/*.test.ts, sort.test.ts   # fixtures and expectations follow
├── browser/bundle.test.ts             # the built script returns the count
└── live/live.test.ts                  # the hosted answer's items carry it (opt-in, as now)

package.json, package-lock.json        # version 0.7.0
README.md                              # the field, what it means, the cost to hand-built items
CLAUDE.md                              # status line
```

**Structure Decision**: the existing layout. No new module: the validator already builds each item, so only it and the type change. The loader hands the SDK's result on as it is, so it needs no code.

## Design

- **Check** (`src/validate.ts`): a small function `parseViewCount(value)` returns the number or nothing. A value is good when `typeof value === "number"` and `Number.isSafeInteger(value)` and `value >= 0`; `-0` is returned as `0`. Anything else, including `undefined` (the field is missing), makes `parseItem` return a problem string, which `parsePage` already turns into `contract_mismatch` for the whole page. The message is `item view_count is not a whole number of 0 or more`, in the style of the existing ones; it names the rule and carries nothing from the service.
- **Where it is read**: destructured with the other fields of the item and placed after `created_at` in the returned object; the type lists it in the same place.
- **Type** (`src/types.ts`): `view_count: number` with a comment: the number of `view` events the service stored for the item, from every platform that reported one; raw (a visitor who refreshes can add many; not a count of people, not for billing; the rule may become stricter); `0` when none; the SDK passes it on and does not format or sum it.
- **Fixture and tests**: `exampleItem` in the contract fixtures gains `view_count` (the service's example does, in spec 019's delta), so every test that spreads it passes a valid item; tests that build items by hand are found by the type checker and fixed. Bad values are table-driven in `validate.test.ts`.
- **Request, errors, loader, events**: untouched (FR-005 to FR-008); a test pins that an existing call's address is the same as before.
- **Docs and version**: README section on the field next to the item's description; `package.json`, the lock file (two places) and the package test to 0.7.0.
- **After the merge** (not part of this feature): the owner tags `v0.6.0` (if not yet) and `v0.7.0` on the merge commit; content-api takes `v0.7.0` in its spec 021, so one deploy brings both `sort` and `view_count`.
