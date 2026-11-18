# Implementation Plan: Sort Option

**Branch**: `006-fetchpage-sort` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-fetchpage-sort/spec.md`

## Summary

Add one optional field, `sort`, to the query that `fetchPage` takes. The request builder checks it against the closed list `popular`, `newest`, `oldest` (exact text, lower case) and, when it is given and valid, sets it as the `sort` parameter with `URLSearchParams`. A `sort` that is anything else (another text, other case, empty, not text, `null`) is a typed `bad_query` error naming `sort`, with no request. Nothing else changes: the result, the error kinds and the cursor handling are as before. The script-tag loader already hands the query it receives to `fetchPage` unchanged, so it needs no code; a test proves it. The version goes from 0.5.0 to 0.6.0 and the README documents the option. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged

**Storage**: N/A

**Testing**: Jest: unit tests of the request builder and `fetchPage` with a fake network function, the no-throw tests, the loader's unit tests, the jsdom test of the built script, and a contract test against content-api's sort contract (read only)

**Target Platform**: current browsers (script tag) and Node 22

**Project Type**: library (unchanged)

**Performance Goals**: none; one more parameter and one membership check

**Constraints**: never throws or rejects into the page; no runtime dependency; no new error kind or result field; a call without `sort` builds the byte-identical address

**Scale/Scope**: one field, one check, one version bump; about 15 lines of code and the tests

## Constitution Check

| Principle | Status |
|---|---|
| I Headless | sends one word, returns the service's items in the service's order; no DOM, no ranking, no score |
| II Untrusted | the 200 body is validated exactly as before; `sort` is only ever checked against a fixed list and sent, never interpreted |
| III No runtime dependencies | none added |
| IV Contract-first, versioned | follows content-api's `delivery-v1-delta` of spec 020 (read only, tested in `tests/contract`); the public API change is additive, documented in `contracts/query-sort.md` and the README, and the version rises by one minor step |
| V Clean, testable | the check is one small function with unit tests; the network stays injected |
| VI Small surface | one optional field with the three values the service accepts; no default, no alias, no type or constant exported beyond the field (research R5) |

No deviation. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/006-fetchpage-sort/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/query-sort.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types.ts             # Query gains `sort?: "popular" | "newest" | "oldest"`
└── request.ts           # check and send sort (one small function, beside checkSearch)

tests/
├── unit/request.test.ts, fetch-page.test.ts, paging.test.ts, no-throw.test.ts, package.test.ts, loader/commands.test.ts, loader/no-throw.test.ts
├── browser/bundle.test.ts
└── contract/delivery-sort.test.ts      # new

package.json, package-lock.json          # version 0.6.0
README.md                                # the option, the values, paging, the known limit
CLAUDE.md                                # status line
```

**Structure Decision**: the existing layout. No new module: the loader forwards the query it receives, so only the request builder and the type change.

## Design

- **Check** (`src/request.ts`, `checkSort`): `undefined` gives nothing to send; a value that is one of the three strings gives that string; anything else gives `badQuery({ fields: ["sort"] })`. The three values are a constant list in the module, not exported (research R5). It sits after the search check and before the cursor, so the parameter order of the address is `limit`, `tag`, `language`, `q`, `sort`, `cursor`. A call without `sort` therefore builds the same address as before (SC-002).
- **Type** (`src/types.ts`): `sort?: "popular" | "newest" | "oldest"`, with a comment that no `sort` keeps the service's order, that a cursor belongs to the order and the `q` that made it, and that with `q` and a `sort` only the matches come back in that order.
- **Loader**: unchanged (`makeFetchPage` passes `query` through); the tests prove a queued command and a direct call carry `sort`, and that a bad `sort` reaches the callback as `bad_query`.
- **Cursor**: untouched. The SDK does not compare the cursor with the `sort` or `q` (FR-006); the service refuses a cursor of another order with `422` naming `cursor`, and the existing 422 path already returns it as `bad_query`.
- **Docs and version**: README section next to the search section; `package.json` and the lock file to 0.6.0; the package test's expected version follows.
- **After the merge** (not part of this feature): the owner tags `v0.6.0` on the merge commit, and content-api takes it in its own small spec, as for 0.3.0 to 0.5.0.
