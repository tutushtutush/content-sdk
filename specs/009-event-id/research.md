# Research: Send the Platform's Own Key for an Event (eventId)

Builds on spec 004 (R4: refuse first what the service refuses), spec 005 (the option style; its R3 left `eventId` out because the SDK does not retry), spec 008 (item and reference events) and content-api spec 016 (`contracts/events-v1-delta.md`, read only; its R1, R5, R6, R7).

## R1. One option, `eventId`, sent as `event_id` (the owner's recommended scope, 2026-11-21)

- **Decision**: `ViewOptions.eventId` is read by the event builder and sent as `event_id` when valid, for item events and reference events alike.
- **Why**: the service stores one event per `(platform, event_id)` and ignores later ones, but only when a key is sent. The platform alone knows two calls are about the same event. Spec 005 R3 declined the option because no requirement needed it; this one does (Listings' repeated calls).

## R2. The rule is the service's rule, with `null` as absent

- **Decision**: a string matching `^[A-Za-z0-9_.:-]{1,128}$`, kept as given (case matters); `undefined` and `null` are absent; anything else is left out. It is read in its own `try`, so a getter that throws is left out with a warning.
- **Why**: exactly content-api R6; the set is ASCII so characters and code units agree, and a JavaScript `$` without the multiline flag refuses a trailing newline. There is **no slash** (an external reference has one; a key does not), so a platform that reuses a reference as a key finds out here with one warning rather than a refused batch.
- **Alternative**: reuse the opaque-text helper of `actorRef` and `sessionId` (any text without NUL). Rejected: wider than the service accepts.

## R3. A bad key is left out and the event is still sent (owner, 2026-11-21)

- **Decision**: one warning (`eventId must be 1 to 128 characters of A-Z, a-z, 0-9 and _ . : -; it was left out.`), no value in it, the event reported without `event_id`.
- **Why**: the SDK's one habit for every bad option (`placementId`, `actorRef`, `sessionId`: leave out, warn, send). A bad key reaching the service would refuse the whole batch, losing other events; refusing the event would lose it. Content-api's R5 rejects ignoring a bad key, but that is the service deciding between refusing and storing a duplicate for a sender that expects deduplication, not what a client does before sending.
- **Cost, stated**: that one event can be stored twice, which is what the key was for. The warning is the platform's signal; the README's guidance says what a good key is.
- **Alternatives**: (a) record nothing for an event whose key is bad: protects the count from duplicates, loses a real view or click, and makes a platform's key bug silent in the data; (b) send the bad key and let the service refuse the whole batch: loses every event batched with it. Both rejected; (a) is reversible by changing one branch.

## R4. The SDK makes no key and remembers nothing (the brief's alternatives (a) and (b), not built)

- **Decision**: no generated key, no in-memory record of what was reported, no skipping of a repeated call.
- **(a) A random UUID per event**: rejected. The SDK never retries (`transport.ts`: one beacon or one fetch) and each call would get a new key, so it deduplicates nothing a platform does twice. It would help only if the SDK later retries, or a browser replays a request; it is also the SDK's first random source. It can be added additively then.
- **(b) Remember in memory what was reported in this page load and skip repeats**: rejected for now. It changes behaviour (a legitimate second click is lost), lasts one page load, and is a client-side counting rule that needs the owner's decision and a constitution reading (I: the SDK owns no event data beyond passing it through).
- **(c) Do nothing and leave it to the platform to call once per thing**: the platform can already do this, but has no safety net for replays; the option adds one without changing anything for it.

## R5. Nothing about a key is checked beyond its form

- **Decision**: the SDK does not check that two events share a key, nor that a view and a click have different ones, nor that a key is unguessable.
- **Why**: it cannot know; the service's first-stored-wins rule decides. A key that two different events share drops the second, and a key made of public values can be forged to block yours: both are the platform's to avoid, so the README says so (User Story 5, FR-006).

## R6. Warnings never hold the value

- **Decision**: the warning says the key was left out and the rule, never the value. SC-004 tests it.
- **Why**: a key may be a UUID or derived from something private; a console should not keep it.

## R7. Version `0.9.0`; documents and the contract test move with it

- **Decision**: version `0.9.0` in `package.json` and its lock; README (the option, and the guidance on choosing a key), the events contract delta, the pointer from spec 004's contract, and the CLAUDE.md status; the one existing test that pins the version changes (named lines in tasks). The contract test's validator learns `event_id` (it ignores unknown keys today). Spec 005's contract line "no `eventId` option" is history and stays; the delta says it is now offered.
- **Why**: public API grows additively (constitution IV); the owner tags after the merge, then content-api takes it in a pin-bump spec.

## R8. Build notes (2026-11-21)

- **Size**: `dist/content-sdk.js` went from 14,295 to 14,564 bytes (+269, limit 1 KB).
- **Tests edited**: only the version pin (`tests/unit/package.test.ts`, lines 20 and 25). The contract validator gained an `event_id` check and cases; no existing line changed. All 2055 earlier tests passed unedited after the code change.
- **Mutation check**: not setting `event_id` failed 40 tests; sending any string as a key (no pattern check) failed 26.
- **Order**: the tests for the valid and the bad key were written first and failed; `rules.ts` was then changed once (read, pattern check, warning together).
- **Reversed or rejected during the build**: nothing. One test of mine assumed two views in one batch; the batch leaves two seconds after its first event, so the test now reads every beacon.
