# Research: Sort Option (SDK feature 006)

Decisions, alternatives considered, and what was started and reversed, with the reason. Dates are 2026-11-18 unless stated.

## R1. The SDK checks the value against the closed list

**Decision**: `sort` must be exactly `popular`, `newest` or `oldest`; anything else is a typed `bad_query` naming `sort`, with no request.

**Why**: the contract states the list exactly, so this is one of the things the client may check (feature 003's rule: the client checks only what the contract states exactly; the service is the final judge). A typo in a platform's code then shows up at once, in the same form as a bad `limit`, instead of as a `422` after a round trip.

**Alternatives**:
- *Pass any text through and let the service refuse it* (the owner's second option): rejected as the default. It costs a request per mistake, and the error would name `sort` only after the network call. It remains correct for a service that adds a fourth value before the SDK does; the SDK then needs a one-line change (R6).
- *Check only that it is a non-empty text*: rejected. It catches less and keeps the same round trip for the common mistake (a wrong word).

## R2. No default sort, and none on the script tag

**Decision**: the SDK adds no default sort, and the tag's settings (`data-api-base-url`, `data-platform-id`) get no `data-sort`.

**Why**: the point of the service's feature is that the caller chooses per request (a home page asks for `popular`, a search page sends nothing). A default in the tag would be one more thing for the platform to override on every call that wants the service's own order, and it would make "no `sort`" mean different things on different pages (constitution VI: add an option only when a requirement needs it).

**Alternative**: a `data-sort` setting on the tag for pages that always want one order. Rejected for now; a platform with one fixed order passes it on each call, which is one word.

## R3. An empty `sort` is a bad value, not "not given"

**Decision**: `sort: ""` is `bad_query` naming `sort`; only `undefined` (or the key left out) means no sort.

**Why**: the service refuses an empty `sort` (`422`), and the SDK checks what the contract says. This differs from `q` on purpose: an empty search box really means "no search", but an empty order is not something a user types; a platform with a "default" choice in a dropdown maps it to `undefined`. Treating `""` as "not given" would hide a bug in the platform's code.

**Alternative**: treat `""` like `q`. Rejected for the reason above; it is a one-line change if the owner prefers it.

## R4. Names

**Decision**: the option is `sort` and the values are the service's, unchanged.

**Alternatives**: `order` (the same word as the service's direction, but the service has no separate direction), `sortBy`, friendlier aliases such as `trending` or `latest` mapped to the service's words, or a `sort: "views"`. Rejected: an alias is a second vocabulary to keep in step with the service, and `views` is not offered by the service at all (content-api spec 020 dropped it).

## R5. Types: an inline union, nothing new exported

**Decision**: `Query.sort` is typed `"popular" | "newest" | "oldest"` inline. The list used for the runtime check is a module constant, not exported, and no `Sort` type is added to the package's exports.

**Why**: a TypeScript caller who writes the literal gets the check from the compiler, and a caller with a variable of type `string` is exactly the one the runtime check is for. Exporting a type or a constant is more surface to keep stable (constitution VI) for little gain; it can be added later without a break.

**Alternative**: export `type Sort` and `SORTS`. Rejected for now.

## R6. When the service adds a value

**Decision**: the list is the service's contract today (three values). A new value is a content-api spec first and then a one-line, additive SDK change and a minor version, as `sort` itself is.

**Why**: this is the price of R1, accepted. A page that needs a new order before the SDK has it cannot send it through `fetchPage`; it waits for the SDK release, which is a small change.

## R7. The SDK does not check the cursor against the order

**Decision**: no client-side check that a cursor was made for the `sort` or `q` it is used with.

**Why**: the SDK keeps nothing between calls (FR-006) and the cursor is opaque; only the service knows which order a cursor belongs to. The service answers `422` naming `cursor`, which the existing 422 path already returns as `bad_query` with the field it named (tested). The README tells the caller to keep the same `sort` and `q` while paging.

## R8. Version

**Decision**: 0.6.0, additive (a new optional field; calls without it are byte-identical). The owner tags it on the merge commit after the merge; content-api's pinned tag moves in its own spec.

## R9. The known limit of a `popular` list is documented, not hidden

**Decision**: the README says that a `popular` list is ranked by the service as of its first page, and that a change in an item's `view_count` between two pages can repeat or skip an item.

**Why**: it is the service's documented limit (content-api spec 020, FR-009), and a platform that pages through a `popular` list will see it. The SDK neither works around it (no snapshot, no de-duplication, constitution I) nor adds a field for it.

## R10. Found while building: the SDK does not return `view_count`

content-api's spec 019 added `view_count` to every delivered item, but this SDK's `Item` type has nine fields and no count: it ignores fields it does not know (constitution IV), so a platform that uses the SDK cannot show "N views" at all. The first version of this spec said items include `view_count`; that was wrong and is corrected (spec, data model, contract, quickstart, tasks).

**Decision**: not part of this feature. Returning the count is its own small, additive change (an optional `viewCount` on the item, or `view_count` kept as the service names it, read as a whole number of 0 or more, with `0` when an older service omits it), and it is the owner's decision, with options and a recommendation first. It matters most with `sort=popular`: a platform that asks for popular posts will want to show why they are popular. Recorded here so it is not forgotten; to be raised with the owner after this feature.

## R11. Found while building: a query object with a throwing getter rejects `fetchPage` (existing, not changed here)

A query object whose property is an accessor that throws (`Object.defineProperty(query, "limit", { get() { throw … } })`) makes `fetchPage` reject today, for `limit` as for every field the request builder reads; `sort` behaves the same way. Plain values of any kind, including hostile ones (an object whose `toString` throws, a symbol), are handled and covered by tests. A getter that throws is not something a platform writes by accident, and guarding it would touch every field, so it is **not** changed in this feature. Recorded for the owner: a small separate fix would wrap the builder so that an exception while reading the query becomes a `bad_query` result.

## Build result (2026-11-18)

Before: 54 suites, 1678 tests. After: 58 suites, 1818 tests (140 more: the request builder, `fetchPage`, paging, the no-throw cases, the contract test, the loader and the built script), typecheck, lint and build clean. The by-hand check against the hosted service is the owner's, after the tag is taken by content-api.
