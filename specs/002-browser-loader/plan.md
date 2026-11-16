# Implementation Plan: Browser Bundle and Loader

**Branch**: `002-browser-loader` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-browser-loader/spec.md`

## Summary

Add a small loader on top of the merged delivery client. A new entry, `src/browser.ts`, runs once when the script loads: it finds its own `<script>` tag, reads `data-api-base-url` and `data-platform-id`, creates or reuses `window.contentSdk`, replays the queued commands in order, and then installs `fetchPage(placementId, query, callback)` as a method (and keeps `q.push` working). The method calls the existing `fetchPage` with the base address and platform id from the tag and passes its result unchanged to the callback and to a returned promise. Everything the loader needs from the page (script tag, console, the global object) is passed in, so unit tests use fakes. The build turns this entry into the minified `dist/content-sdk.js` (no `ContentSdk` global any more), `package.json` gains a `./browser` subpath, a `prepare` script and a `files` list. Design choices were made by the owner on 2026-11-16 (research D1, D2).

## Technical Context

**Language/Version**: TypeScript 5.9, strict; target ES2020 (unchanged)

**Primary Dependencies**: none at runtime; dev tools unchanged (TypeScript, esbuild, Jest, ESLint, jsdom for tests)

**Storage**: N/A (the loader stores and reads nothing)

**Testing**: Jest. Loader unit tests inject a fake environment; one jsdom test loads the built `dist/content-sdk.js` as a script in a page with the stub and a fake network function; the 001 suite runs unchanged

**Target Platform**: current browsers (script tag) and Node 22 (the file path, the 001 entries)

**Project Type**: library, with a second build output (the browser file)

**Performance Goals**: none beyond "small": the file is the 001 client plus a few hundred lines; no work at load beyond reading two attributes and replaying the queue

**Constraints**: no DOM creation, no styles, no storage, no extra requests; never throws or rejects into the page; one global (`contentSdk`)

**Scale/Scope**: one new entry, about four small modules, one test page

## Constitution Check

*GATE: passes before research and after design.*

| Principle | Check | Result |
|---|---|---|
| I. Headless: data only | The loader returns the delivery client's plain result; it creates no element, injects no style, renders nothing. It only reads its own script tag and two attributes | Pass |
| II. Everything received is untrusted | Attributes and queue entries are checked (type, blank, name) before use; the network answer is still validated by the 001 client; warnings quote only fixed text plus a clipped command name | Pass |
| III. No runtime dependencies | None added. Uses `Promise`, `console` and the delivery client; the loader reads the page through an injected environment | Pass |
| IV. Contract-first and versioned | The loader's public surface is written first in [contracts/loader.md](contracts/loader.md); a breaking change to it needs a major version; the 001 contract tests still run | Pass |
| V. Clean, testable code | The page, console and global object are injected; `src/browser.ts` is the only file that touches real globals | Pass |
| VI. Small, honest surface | One command, one global, two attributes; no `signal`, no timeout, no extra commands | Pass |

The one thing to note: the loader reads the page. Principle I forbids rendering, creating DOM and injecting styles, not reading, so this is allowed. It is kept to `src/loader/` and `src/browser.ts`; the 001 modules stay free of `window` and `document` (FR-012). No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-browser-loader/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── loader.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── (001 files unchanged: index.ts, types.ts, request.ts, validate.ts, errors.ts, guards.ts, fetch-page.ts)
├── browser.ts           # entry of the browser file: install(globalThis), nothing else
└── loader/
    ├── env.ts           # the small structural types of what the loader needs from the page
    ├── settings.ts      # reads the two attributes from a script tag; says which are bad
    ├── commands.ts      # the command table and fetchPage(placementId, query, callback)
    ├── warn.ts          # one safe warning function (never throws, clips text)
    └── install.ts       # install(env): find script, stub, replay, methods, double load

tests/
├── unit/loader/         # settings, commands, install with a fake env
├── browser/             # jsdom test that loads the built dist/content-sdk.js
├── setup/build.ts       # Jest globalSetup: builds dist/ once before the run
├── unit/package.test.ts, unit/entries.test.ts   # package.json and entry-point checks
└── (001 tests unchanged)

scripts/build.mjs        # browser entry is src/browser.ts; the IIFE has no globalName
package.json             # exports ./browser, files, prepare, version 0.2.0
README.md                # Embedding section
```

**Structure Decision**: loader code lives beside the client in `src/loader/` and imports only `fetchPage` and the types from 001. `src/index.ts` does not export it, so `import "content-sdk"` is unchanged (SC-006). Only `src/browser.ts` touches real globals; the rest takes an `Env`.

## Complexity Tracking

No violations.
