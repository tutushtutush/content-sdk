# Research: Report the Visit with a Session Id

Decisions, the alternatives considered, and what was rejected, with the reason. Builds on spec 004 (research R4: refuse first what the service refuses; the events contract is read only from content-api) and on content-api spec 017 (the stored `session_id`, its research R1 to R9).

## R1. One option, `sessionId`, sent as `session_id` (owner, 2026-11-17)

- **Decision**: `ViewOptions.sessionId` is read by the event builder and sent as `session_id` when valid.
- **Why**: content-api now stores a visit reference per event, and what an event does not carry when it is stored can never be added later. The platform has the visit (its session, cookie or page flow); the SDK does not.
- **Alternative**: nothing, and platforms put a session id in `actorRef`. Rejected: `actorRef` is the user or device (content-api spec 017 R2), and mixing two meanings in one field makes counting distinct sessions and distinct devices impossible later.

## R2. The platform supplies it; the SDK generates and stores nothing (decided from the constitution, owner to confirm)

- **Decision**: the SDK sends a session id only when the platform gives one for that call. No default, no generated id, no memory between calls, no storage or cookie.
- **Why**: constitution I says the SDK "MUST NOT own any content or event data beyond what it passes through", and an id the SDK makes and holds is event data it originates. VI says an option is added only when a requirement needs it; a generated default is one more behaviour with no requirement behind it yet. The platform can make its own random id in one line. It also avoids any storage or consent question.
- **Alternatives**:
  - **(a)** a random id made once per page load and kept in memory, used when the platform gives none. Cheapest default, no storage; a multi-page site gets one session per page load. Needs a constitution reading of "owns event data" and the owner's decision.
  - **(b)** a random id kept in `sessionStorage` per tab. Continuity across pages; the SDK's first use of browser storage, and a privacy question.
  - **(c)** a script-tag attribute or a global setting (`data-session-id`, `configure`). Rejected: a session id is per visit, so a value fixed when the tag loads fits server-rendered ids only, and a setting adds a surface (VI) the per-call option does not.
- **Reversible**: (a) or (b) can be added later as an additive default, with no change for a platform that passes its own.

## R3. No `eventId` option, and no generated event id

- **Decision**: the SDK sends no `event_id` and takes no option for one.
- **Why**: content-api's `event_id` only helps when a sender retries, and the transport "never retries" (one beacon, or one keep-alive fetch if the beacon is unavailable, never both). A random key per call would never repeat, so it would dedupe nothing; a deterministic one (for example session, item and kind) would be a counting policy the owner has rejected for the service. A pass-through option has no requirement (VI).
- **Alternative**: generate `crypto.randomUUID()` per event now. Rejected for the reason above, and it would be the SDK's first random source.
- **Later**: if the SDK ever retries, a generated key per event is the way to do it safely, and it comes with that change.

## R4. The rule is `actorRef`'s rule, with `null` as absent

- **Decision**: text of 1 to 128 characters counted as characters, no NUL, kept as given; `undefined` and `null` are absent; anything else is left out with one warning and the event is still reported. The option is read in a `try` like the others, so a getter that throws is left out with a warning.
- **Why**: the service refuses a whole batch for one bad value (content-api spec 017 R4), so refusing first here protects the batch (spec 004 R4). The same rule as `actorRef` keeps one habit for platforms. `null` is allowed because the service accepts it and a platform that builds one options object can say none.
- **Note**: `actorRef: null` is still warned about, as in v0.4.0; this change does not alter it.
- **Alternative**: let the service refuse. Rejected: one bad id would lose the whole batch of events.

## R5. Warnings never hold the value

- **Decision**: the warning says the option was left out and the rule, never the value, as for `actorRef`.
- **Why**: the value is opaque and might identify a person if a platform misuses it; a console or a log should never keep it. SC-004 tests it.

## R6. Version `0.5.0`; documents and the contract test move with it

- **Decision**: `package.json` and the lock file go to `0.5.0`. The README's "Reporting views and clicks" names the option and says: random or hashed values, never an email, a name or anything that identifies a person. The events contract of spec 004 gets a pointer to this feature's delta. The contract test validator learns `session_id` (1 to 128 characters, no NUL).
- **Why**: a new option is a minor, additive version (constitution IV); the owner tags the release after the merge, and content-api takes it in its own spec.

## R7. The loader needs no change

- **Decision**: `src/loader/commands.ts` already hands the platform's options straight to the reporter, so the queue form passes `sessionId` with no edit; a test proves it.

## R8. Size

- **Decision**: no budget work beyond a check. The built script is 13,146 bytes minified today; one more read, one check and one property is expected to add about 0.2 KB, well inside SC-006's 1 KB.

## R9. Checks made while building (2026-11-17)

- **Size**: `dist/content-sdk.js` went from 13,146 to 13,423 bytes minified, 277 bytes, inside SC-006's 1 KB.
- **The sent-value tests catch a missing line** (a proper mutation): with the line that sets `event.session_id` replaced by `void sessionId;`, 37 tests fail across the rule, reporter, contract and built-script tests; restored, all 1,672 pass. A first attempt at the mutation removed the statement and left `if (...) else`, a syntax error that proves nothing; it was redone and is noted here so the number above is not read as that run.
- **Order of work**: the rule tests (T003, T008, T013) were written before the code and 44 failed first; the unit tests of the reporter, the no-throw tests, the loader test, the built-script tests and the contract test were written after the code they exercise, which Phase 2 and 3 already contained, so the mutation check stands in for the failing-test step there.
- **No storage, cookie or random source**: the built-script test spies on `localStorage`, `sessionStorage`, `document.cookie`, `Math.random` and, where the jsdom environment provides them, `crypto.getRandomValues` and `crypto.randomUUID`, over a full lifecycle, and none is touched after the script has loaded.
- **The one existing test that changed**: the version pin in `tests/unit/package.test.ts` (the test's name and the assertion). Nothing else in the existing tests was edited; the loader, batcher and transport were not touched.
- **README**: the old text called `actorRef` "a device or session id"; it now says user or device, with `sessionId` as the visit, so the two are not mixed.

- **Convergence (T026)**: `/speckit-converge` found that the library form (`createLibrary(...).trackLinkClick(target, item, options)`) passed `sessionId` through but had no test. Three cases were added to `tests/unit/events/library.test.ts` (a click with and without an id, a view once seen, a bad value with one warning that does not hold it). With the library's click path changed to drop its options, 4 of them fail; restored, all 1,678 tests pass.

## Approaches started and rejected

None. Nothing was started and then reversed during the build, apart from the mutation attempt in R9, which was a mistake in the test of the tests and not an approach.
