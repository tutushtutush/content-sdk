# Implementation Plan: Delivery Client

**Branch**: `001-delivery-client` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-delivery-client/spec.md`

## Summary

One async function, `fetchPage(target, query?, options?)`, builds the delivery request, calls an injectable `fetch`, validates the answer by hand, and always resolves to a result object: `{ ok: true, page }` or `{ ok: false, error }`. The page is plain data (the nine-field item plus `nextCursor`); the error is a plain object with a `kind`. No runtime dependencies. Built with esbuild into ESM, CommonJS and an IIFE bundle, with type declarations from `tsc`. Design choices were made by the owner on 2026-11-16 (see [research.md](research.md) D1 to D4).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020

**Primary Dependencies**: none at runtime. Dev only, as in `ad-serve-client`: TypeScript, esbuild, Jest (+ ts-jest), ESLint (+ typescript-eslint)

**Storage**: N/A

**Testing**: Jest in two projects (Node, and jsdom as the browser-like run). Unit tests with a fake `fetch`; contract tests against the shapes in content-api's contract files; one opt-in live check against the hosted test service (skipped unless an env flag is set)

**Target Platform**: current browsers and Node 22 (`fetch`, `URL`, `URLSearchParams`, `AbortSignal`)

**Project Type**: library (headless SDK)

**Performance Goals**: none beyond "no extra work": one request per call, one pass over the answer

**Constraints**: no DOM, no markup, no runtime dependency, no credentials or custom headers, never throws or rejects

**Scale/Scope**: one public function, about six small modules, pages of at most 50 items

## Constitution Check

*GATE: passes before research and after design.*

| Principle | Check | Result |
|---|---|---|
| I. Headless: data only | Returns plain objects; no DOM, no styles, no rendering | Pass |
| II. Everything received is untrusted | Hand validation of every field; text returned unchanged and never used to build markup; failures are typed results | Pass |
| III. No runtime dependencies | Only `fetch`, `URL`, `URLSearchParams`, `AbortSignal`; dev tools as in `ad-serve-client` | Pass |
| IV. Contract-first and versioned | Targets `/api/v1`; unknown fields ignored; public API documented in [contracts/public-api.md](contracts/public-api.md) before code; contract tests use the contract examples | Pass |
| V. Clean, testable code | Strict TS, ESLint, `fetch` injected; no clocks or timers used | Pass |
| VI. Small, honest surface | One function, no client object, no paging helper, no timeout option, no retry | Pass |

Technology constraints: TypeScript strict, Node 22 tooling, esbuild, Jest, ESLint. One deliberate difference from `ad-serve-client`: it ships CommonJS and a bundle with no declarations. The owner chose ESM, CommonJS, an IIFE bundle and `.d.ts` (D3). No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-delivery-client/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── public-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── index.ts          # public exports: fetchPage and the types
├── types.ts          # Target, Query, Options, Item, Image, Page, DeliveryError, Result
├── request.ts        # checks target and query, builds the request address
├── validate.ts       # checks the 200 body, returns a Page or a mismatch description
├── errors.ts         # error constructors and status-to-kind mapping
└── fetch-page.ts     # puts the pieces together; the only place that calls fetch

tests/
├── unit/             # request, validate, errors, fetch-page with a fake fetch
├── contract/         # runs fetchPage against the example bodies from content-api's contracts
└── live/             # opt-in check against the hosted test service

scripts/build.mjs     # esbuild: ESM, CJS, IIFE bundle
package.json, tsconfig.json, tsconfig.build.json, eslint.config.mjs, jest.config.ts
```

**Structure Decision**: single library project, flat `src/`, layout and tool config copied from `ad-serve-client` and adapted for the extra outputs. The Node project has no DOM, so a stray DOM use fails a test (SC-006); a second jsdom project reruns the unit and contract tests as the browser-like environment (SC-002).

## Complexity Tracking

No violations.
