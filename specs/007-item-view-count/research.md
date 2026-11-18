# Research: Item View Count (SDK feature 007)

Decisions, alternatives considered, and what was started and reversed, with the reason. Dates are 2026-11-18 unless stated.

## R1. The field is required, and a page without it is refused (owner's option A)

**Decision**: every item must carry `view_count`; a missing or bad value makes the whole page a `contract_mismatch`.

**Why**: the contract (content-api spec 019) says the field is on every item, a whole number of 0 or more, never missing and never `null`. The SDK checks every field the contract states exactly and refuses the page otherwise (`url` is the precedent). A refusal is loud: if the service and the SDK disagree, it shows at once, and it cannot be mistaken for "no views". The SDK is served by the same content-api that sends the field (since spec 019), so script and service move together.

**Alternatives** (the owner chose A after the three were put side by side):
- *B. Default a missing count to 0*: rejected. Nothing would ever fail, but a service that dropped the field would make every post read "0 views", plausible and wrong, and nobody would notice. The worst outcome for a number whose job is to show attention.
- *C. Optional (`view_count?: number`, absent when the service sent none)*: rejected. It would work against an old service, but every platform would have to write `item.view_count ?? 0`, for a case that does not occur in practice, and the type would tell platforms the contract allows the field to be missing, which it does not.

**Cost accepted**: a service older than spec 019 gets every page refused. There is none the SDK talks to.

## R2. The name is `view_count`

**Decision**: spelled as the service spells it, like `created_at`.

**Alternative**: `viewCount`. Rejected: the item already keeps the service's spelling (`created_at`, and the result's `nextCursor` is the one place the SDK renames, for the page, not the item), so a platform reads the item's fields against the contract directly, and a renaming layer is one more thing to keep in step. (feature 006's research R10 used `viewCount` as one of two possibilities; this is the decision.)

## R3. Which numbers are good

**Decision**: a `number` that is a safe integer (`Number.isSafeInteger`) and at least 0. `-0` is accepted and returned as `0`. Everything else refuses the page.

**Why**: a count is a whole number of 0 or more (the contract); the safe-integer limit is the largest number a JSON number can carry exactly, so a larger one would already have lost precision on the way (the service keeps the count in a 64-bit column and sends it as a JSON number, so a value past this limit would already be inexact). JSON itself cannot carry `NaN` or infinity, but a parsed value can still be a number like `1e300`, which is not a safe integer and is refused.

**Alternatives**:
- *Return it as text*: rejected. The service sends a number; text invites string concatenation bugs and sorting by text.
- *Clamp or round a bad value* (a fraction to the nearest whole, a negative to 0, a huge value to the safe maximum): rejected. It hides drift; the SDK does not repair what the service sends (constitution II).
- *Accept a numeric text such as `"5"` and convert it*: rejected for the same reason; the contract says a number.

## R4. The whole page is refused, never a partial one

**Decision**: one item with a bad `view_count` refuses the page, as one item with a bad `url` does.

**Why**: the SDK's rule since feature 001 (a partial page would show a list that silently misses items, and the next cursor would skip them).

## R5. Truthiness is never used

**Decision**: the check tests the type and the number, not whether the value is truthy.

**Why**: `0` is a valid count and the most common one; a check like `if (!value)` would refuse it.

## R6. The exported `Item` type requires the field

**Decision**: `view_count: number` is not optional in the type.

**Why**: it follows R1 (the SDK never returns an item without it). The cost is type-level: code that builds `Item` values by hand, such as a platform's own tests or mocks, must add the field. The README says so. For code that only reads items it is additive.

## R7. No formatting, no helper, no display

**Decision**: the SDK passes the number on as it is and does not format it ("1,204", "1.2k"), pluralize it, or sum it with views the SDK reports.

**Why**: the SDK is headless (constitution I) and the wording and locale of "N views" are the platform's. The SDK keeps nothing between calls, so it could not add its own reported views anyway.

## R8. Meaning of the number is stated, not softened

**Decision**: the README says the count is raw: every stored `view` event counts, so a visitor who refreshes ten times can add ten; it includes views reported by other platforms; it is not a count of people and not for billing; the rule may become stricter and the number lower.

**Why**: it is the service's documented meaning (content-api spec 019) and a platform that shows it should know what it is showing.

## R9. Where the service example lives in the tests

**Decision**: `exampleItem` in `tests/contract/fixtures/delivery-v1.ts` gains `view_count` (a whole number), as content-api's delta example does; the contract test `item-view-count.test.ts` states the rules read from content-api's `specs/019-item-view-counts/contracts/delivery-v1-delta.md` (read only).

**Why**: the contract tests use the service's own examples verbatim, so a change in the contract shows up here.

## R10. The version

**Decision**: 0.7.0, additive for platforms that read items. The owner tags it on the merge commit; content-api's pinned tag moves in its spec 021, directly to `v0.7.0`, so one deploy brings both `sort` (0.6.0) and `view_count`.

## Build result (2026-11-18)

Before: 58 suites, 1818 tests. After: 62 suites, 1946 tests (128 more: the validator, `fetchPage`, the contract rules, the loader and the built script), typecheck, lint and build clean. This feature resolves feature 006's research R10 (the SDK did not return `view_count`). The by-hand check against the hosted service is the owner's, after content-api takes the tag. The opt-in live test was not run.
