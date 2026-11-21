# Research: Report Events About Things That Are Not Items (External Reference)

Builds on spec 004 (R4: refuse first what the service refuses), spec 005 (the options' style) and content-api spec 022 (`contracts/events-v1-delta.md`, read only; its R1, R2, R4, R5).

## R1. Which fields count as "given", and the present-but-bad `id` with a reference (owner's recommendation, 2026-11-20)

- **Decision**: a field is *given* when its value is neither `undefined` nor `null` (the service counts `null` as not given). Both given, or neither given, is refused with one warning. An `id` that is given but not a UUID, together with an `externalRef`, is "both" and is refused. An `id` given and bad, with no reference, keeps the v0.7.0 refusal and warning.
- **Why**: the SDK must never send both fields or neither, since the service refuses the whole batch. Treating a bad `id` as "not given" and sending the reference would silently drop a platform's mistake, and a platform that puts a wrong id and a reference on one object has a bug the warning should show.
- **Alternative**: a bad `id` is ignored and the reference is sent. Rejected: hides a platform bug; and an `id` of `""` or `5` is plainly meant as given.
- **Note**: `{ id: null }` was refused with the "needs an id" warning in v0.7.0; it still is (neither given). Existing tests are unchanged.

## R2. Same call, wider item parameter; no new method

- **Decision**: `watchView(element, item, options)` and `trackLinkClick(item, options)` keep their names and positions. The item may be `{ id }` or `{ externalRef }`.
- **Why**: the options and everything around them work the same; a new method would double the surface (VI) and the loader's commands.
- **Alternative**: `watchExternal` and `trackExternalClick`. Rejected for the reason above.

## R3. The rule for a reference is the service's rule, checked as one pattern

- **Decision**: `^[A-Za-z0-9_.:/-]{1,128}$` on a string. The set is ASCII, so characters and code units agree, and an accented letter, a space, a NUL or a newline fails. Case is kept as sent.
- **Why**: it is exactly the service's rule (delta, "Request" and "Answers"); a JavaScript `$` without the multiline flag does not accept a trailing newline.
- **Alternative**: normalise (lowercase, trim). Rejected: the service keeps it as sent and case matters; changing it would split one thing's events in two.

## R4. Warnings never hold the value

- **Decision**: each refusal has its own plain message: the item needs exactly one of `id` and `externalRef` (both, neither); `externalRef` must be 1 to 128 characters of `A-Za-z0-9_.:/-`; each says no event was recorded. None repeats the value.
- **Why**: a reference is chosen by the platform and a platform may misuse it; a console should not keep it (SC-004). The existing "needs an id that is a UUID" text is kept for the item-event refusals.

## R5. No placement, no `event_id`, no prefix rule

- **Decision**: the SDK sends only what the platform passes. No default `placement_id` (the service drops a reference event whose named placement is missing or disabled, and keeps one with none), no `event_id` (the SDK does not retry), and no check on what the reference means.
- **Why**: owner decisions (2026-11-20) and constitution VI; the service has no allowed-prefix rule.

## R6. Types: a union, not exported

- **Decision**: in `types.ts`, `{ id: string; externalRef?: never } | { externalRef: string; id?: never }`, used for the item parameter of the library calls. It is not exported from the package. A fetched `Item` (no `externalRef` property) is assignable to the first shape.
- **Why**: "neither" must fail to compile and "both" should too, with no new public name (FR-008, VI). The runtime stays defensive because the script-tag form and untyped callers have no types.
- **Alternative**: export it as `ReportedItem`. Not needed now; it can be added without a break if platforms ask.

## R7. Version `0.8.0`; documents and the contract test move with it

- **Decision**: version `0.8.0` in `package.json` and its lock; README, the events contract delta, the pointer from spec 004's contract, and the CLAUDE.md status are updated. The contract test's validator learns `external_ref` and "exactly one of" (its line 22 requires `item_id` today, so it changes; the task names the line). The README says: send public identifiers only, fix the format early.
- **Why**: public API grows additively (constitution IV); the owner tags after the merge, then content-api takes it in a pin-bump spec.

## R8. Build notes (2026-11-20)

- **Size**: `dist/content-sdk.js` went from 13,838 to 14,295 bytes (+457, limit 1 KB).
- **Types**: `EventRecord` is the union `{ item_id; external_ref?: never } | { external_ref; item_id?: never }` (analysis F1), so existing tests that read `event?.item_id` compile unedited. `ReportedItem` is declared in `types.ts` and used by the library calls; it is not exported from the package (R6).
- **Tests edited**: only the version pin (`tests/unit/package.test.ts`) and the validator's `item_id` line (`tests/contract/events-v1.test.ts`), as the tasks name. All 1946 earlier tests passed unedited after the code change and before the version bump.
- **Mutation check**: setting `item_id` in place of `external_ref` failed 22 tests; disabling the "both" refusal failed 14.
- **Reversed or rejected during the build**: nothing.
