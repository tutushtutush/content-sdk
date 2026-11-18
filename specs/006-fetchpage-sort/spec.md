# Feature Specification: Sort Option

**Feature Branch**: `006-fetchpage-sort`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Sort option for the SDK: `fetchPage` accepts a `sort` in its query (`popular`, `newest` or `oldest`) and sends it to content-api's delivery endpoint, which reads it since content-api spec 020 (merged 2026-11-18, PR #28). The SDK checks the value against that closed list before sending, as it does for `limit` and `q`: a bad value is a typed `bad_query` error naming `sort`, with no request made. Without `sort` the request is exactly what v0.5.0 sends. The cursor is passed through as today; the README says a caller must keep the same `sort` (and `q`) while paging. The script-tag loader's page-facing `fetchPage` gets the same option. Version 0.6.0, additive. The SDK adds no default sort, makes no sort of its own and returns no score."

**Builds on**: [001-delivery-client](../001-delivery-client/spec.md), [002-browser-loader](../002-browser-loader/spec.md) and [003-search-query](../003-search-query/spec.md) (all merged). **Contract read from** (read only): content-api `specs/020-delivery-sort/contracts/delivery-v1-delta.md`, which amends `specs/009-public-delivery-endpoint/contracts/delivery-v1.md` and `specs/012-search-q/contracts/search-v1.md`.

The "user" is a **platform developer** who builds a page that shows content-api items with the platform's own components. Visitors never see the SDK; they see a home page of popular posts, a list of the newest, or search results, all rendered by the platform from the data it receives.

**Why**: the service can now order a page as the caller asks, but a platform that uses the SDK has no way to ask: `fetchPage` sends no `sort`, so every page comes back in the service's default order. A home page that should show popular posts from any category, next to a search page that keeps its own order, needs the platform to say which order it wants on each call.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A home page asks for the popular items (Priority: P1)

A platform developer passes `sort: "popular"` in the query of `fetchPage` and receives the page in the order the service chose, as plain data, with the cursor for the next page. Everything else about the call and the result is as before.

**Why this priority**: it is the whole feature; without it the platform cannot show popular posts through the SDK.

**Independent Test**: call `fetchPage` against a fake service with `sort: "popular"` and confirm the request carries `sort=popular`, that the result holds the items the fake returned in the same order, and that a call without `sort` sends no `sort`.

**Acceptance Scenarios**:

1. **Given** a query with `sort: "popular"`, **When** the SDK sends the request, **Then** the service receives `sort=popular` and no other parameter the developer did not give.
2. **Given** `sort: "newest"` or `sort: "oldest"`, **When** the request is sent, **Then** the service receives that value, each exactly as given.
3. **Given** a query without `sort`, or with `sort` undefined, **When** the SDK sends the request, **Then** no `sort` is sent and the request is exactly what v0.5.0 sent.
4. **Given** `sort` together with `limit`, `tags`, `languages`, `q` and `cursor`, **When** the request is sent, **Then** all of them are sent, each in its own form.
5. **Given** the result of a `popular` call, **When** it is returned, **Then** its shape is unchanged: the same page, items and error kinds, with no score and no new field.

---

### User Story 2 - A bad sort is a typed error, not a throw (Priority: P1)

A `sort` that is not one of the three values is reported as a typed `bad_query` error naming `sort`, without sending a request, so a typo in the platform's code shows up at once and in the same form as every other bad query value.

**Why this priority**: the SDK never throws into a platform's page, and it checks what the contract states exactly; the list of three is exact.

**Independent Test**: call `fetchPage` with `sort` set to `"best"`, `"Popular"`, `""`, a number, `null`, a list and an object; each resolves to `{ ok: false, error }` with kind `bad_query` and `fields` naming `sort`, and the fake service is never called.

**Acceptance Scenarios**:

1. **Given** `sort` is text that is not `popular`, `newest` or `oldest` (another word, other case, spaces around it, empty), **When** the call is made, **Then** the result is `bad_query` naming `sort` and nothing is sent.
2. **Given** `sort` is not text (a number, an object, a list, `null`, a boolean), **When** the call is made, **Then** the same.
3. **Given** the service refuses a `sort` with `422` (a service newer or older than the SDK), **When** the answer arrives, **Then** the result is the usual `bad_query` error with the field names the service gave, and no second attempt is made.

---

### User Story 3 - Paging keeps the order (Priority: P2)

A platform developer takes the cursor from a page and asks for the next page by passing the same `sort` (and the same `q`) with it. The SDK passes both through unchanged and keeps nothing between calls.

**Why this priority**: a list longer than one page needs paging, but the first page already works without it.

**Independent Test**: with a fake service, fetch a first page with `sort: "popular"`, pass its cursor and the same `sort` for the second, and confirm both are sent as given; a fake that refuses a cursor made for another order with `422` naming `cursor` gives a `bad_query` error naming `cursor`.

**Acceptance Scenarios**:

1. **Given** a first page with a next cursor, **When** the developer passes that cursor with the same `sort`, **Then** the request carries both unchanged.
2. **Given** a cursor from one order used with another `sort` (or none), **When** the service refuses it with `422`, **Then** the result is the usual `bad_query` error naming `cursor`, and the SDK does not retry.
3. **Given** the SDK has made earlier calls with a `sort`, **When** a later call gives none, **Then** it sends none: the SDK remembers no `sort`, no `q` and no cursor.

---

### User Story 4 - Sort from a script tag (Priority: P2)

A platform that loads the SDK with the script tag calls the page-facing `fetchPage` command with `sort` in its query, before or after the script has loaded, and gets the same result as a developer using the module.

**Why this priority**: the script tag is the way platforms are expected to load the SDK; the option has to work there as well.

**Independent Test**: in the loader's browser-like test, queue a `fetchPage` command with `sort` before load, run it after, and confirm the request carries `sort`; call the exposed method directly with `sort` and confirm the same.

**Acceptance Scenarios**:

1. **Given** a command queued before the script loaded, **When** it has `sort` in its query, **Then** it is replayed with `sort` and the callback receives the result.
2. **Given** the script has loaded, **When** the page calls `window.contentSdk.fetchPage` with `sort`, **Then** the request carries `sort`.
3. **Given** a bad `sort` in a queued command, **When** it runs, **Then** the callback receives the `bad_query` result and nothing throws.

### Edge Cases

- An empty `sort` (`""`) is a bad value, not "not given": the service refuses an empty `sort` too, and the SDK does not guess. A page whose dropdown has a "default" choice passes `undefined` (or leaves the key out) for it. (This differs from `q`, where an empty search box means no search.)
- `sort` is read case-sensitively, in lower case, as the service does; `"Popular"` is a bad value.
- A `sort` of `popular` or `oldest` with a cursor that was made without it is refused by the service, not by the SDK, because only the service knows which order a cursor belongs to.
- A `sort` with `q` returns only the matches in the asked order; the SDK does nothing about that, and a caller who wants best match first sends no `sort`.
- A service older than content-api spec 020 ignores `sort` and returns its usual order; the SDK cannot tell and does not try to.
- A `popular` list is ranked by the service as of its first page, and a change in an item's `view_count` between two pages can repeat or skip an item. This is the service's known limit; the SDK neither hides nor works around it, and the README says so.
- The result type is unchanged: items hold the same fields as before, and nothing about ranking (a score) is added by the SDK. The SDK does not return the service's `view_count` either: it ignores fields it does not know, and returning the count is a separate decision (research R10).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The query MUST accept an optional `sort` whose value is one of `popular`, `newest`, `oldest`, in lower case.
- **FR-002**: When `sort` is given with one of the three values, the request MUST carry it as the `sort` parameter, exactly as given, together with every other parameter the developer gave, each in its own form.
- **FR-003**: When `sort` is not given (absent or `undefined`), the request MUST be exactly what v0.5.0 sends, with no `sort`, and the SDK MUST NOT add a default sort of its own.
- **FR-004**: A `sort` that is anything else (another text, other case, with spaces, empty, not text, `null`) MUST give a `bad_query` result with `fields` naming `sort`, and MUST NOT send a request.
- **FR-005**: A `422` from the service for `sort` or for `cursor` MUST come back as the usual `bad_query` result with the field names the service gave, with no retry.
- **FR-006**: The cursor MUST pass through unchanged; the SDK MUST NOT keep the last `sort`, `q` or cursor between calls, and MUST NOT check that a cursor agrees with the `sort` it is used with.
- **FR-007**: The script-tag loader's page-facing `fetchPage` MUST accept `sort` in its query, for commands queued before load and calls after it, with the same result and error behavior.
- **FR-008**: The result MUST be unchanged in shape: the same page, items and error kinds; no score, no new field, no new error kind.
- **FR-009**: Nothing in this feature may throw or reject into a platform's page (constitution I, the SDK's no-throw rule), whatever value `sort` holds.
- **FR-010**: The README MUST show the option and its three values, that no `sort` keeps the service's default order, that a cursor belongs to the order (and `q`) that made it so the caller keeps both while paging, that with `q` and a `sort` only the matches come back in that order, and the known limit of a `popular` list (a changing view count can repeat or skip an item between pages).
- **FR-011**: The package version MUST rise by one minor step (0.6.0, additive); publishing the tag is the owner's act.
- **FR-012**: No other value, no other parameter, no sorting by price or a platform's own field, no score and nothing about events is added.

### Key Entities

- **Query** (existing): gains one optional field, `sort`.
- No new entity, error kind or result field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the three values, the request address carries exactly `sort=<value>`, alone and together with `limit`, `tags`, `languages`, `q` and `cursor`.
- **SC-002**: A call without `sort` produces a byte-identical request address to v0.5.0 in every existing test.
- **SC-003**: Every bad `sort` in the scenarios (at least ten values: another word, other case, spaces, empty, number, `null`, boolean, list, object) resolves, never throws, and makes no request.
- **SC-004**: The same `sort` works through the module and through the script tag, in a queued command and in a direct call.
- **SC-005**: A platform developer can build a home page of popular posts and a search page in the default order from the README alone, with no knowledge of the service's internals.

## Assumptions

- The list of three values is the service's contract (content-api spec 020); when it grows, the SDK adds the value in its own small change, as the contract says only those three are valid.
- The SDK's own checks cover only what the contract states exactly; the service stays the final judge (constitution I and 003's rule).
- A platform supplies `sort` per call; the script tag's settings (base address and platform id) get no default sort (research R2).
- Publishing the tag, and the content-api change that takes it, are separate steps by the owner.
