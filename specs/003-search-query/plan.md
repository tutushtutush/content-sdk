# Implementation Plan: Search Option

**Branch**: `003-search-query` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-search-query/spec.md`

## Summary

Add one optional field, `q`, to the query that `fetchPage` takes. The request builder checks it (text; at most 100 characters after trimming; empty or spaces-only means not given) and, when it is given, sets it as the `q` parameter with `URLSearchParams`, which encodes every character so none can change another parameter or the path. Nothing else changes: the result, the error kinds and the cursor handling are as before. The script-tag loader already hands the query it receives to `fetchPage` unchanged, so it needs no code; a test proves it. The version goes from 0.2.0 to 0.3.0 and the README documents the option. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: N/A

**Testing**: Jest: unit tests of the request builder and `fetchPage` with a fake network function, the loader's unit tests, the jsdom test of the built script, and a contract test against content-api's search contract (read only)

**Target Platform**: current browsers (script tag) and Node 22

**Project Type**: library (unchanged)

**Performance Goals**: none; one more parameter and one length check

**Constraints**: never throws or rejects into the page; no runtime dependency; no new error kind or result field; a call without `q` builds the byte-identical address

**Scale/Scope**: one field, one check, one version bump; about 30 lines of code and the tests

## Constitution Check

| Principle | Status |
|---|---|
| I Headless | sends text, returns the service's items; no DOM, no ranking, no highlighting |
| II Untrusted | the 200 body is validated exactly as before; `q` is only ever sent, never interpreted |
| III No runtime dependencies | none added; `URLSearchParams` and `String` only |
| IV Contract-first, versioned | follows content-api's `search-v1` (read only, tested in `tests/contract`); the public API change is additive, documented in `contracts/query-q.md` and the README, and the version rises by one minor step |
| V Clean, testable | the check is one small function with unit tests; the network stays injected |
| VI Small surface | one optional field; the client checks only what the contract states exactly (text, 100 characters) |

No deviation. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-search-query/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/query-q.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types.ts             # Query gains `q?: string`
└── request.ts           # check and send q (one small function)

tests/
├── unit/request.test.ts, fetch-page.test.ts, no-throw.test.ts, package.test.ts, loader/*.test.ts
├── browser/bundle.test.ts
└── contract/search-v1.test.ts      # new

package.json, package-lock.json      # version 0.3.0
README.md                            # the option, the limits, paging a search
```

**Structure Decision**: the existing layout. No new module: the loader forwards the query it receives, so only the request builder and the type change.

## Complexity Tracking

None.
