# Feature Specification: Search Option

**Feature Branch**: `003-search-query`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Search option for the SDK: fetchPage accepts a text search `q` in its query and sends it to content-api's delivery endpoint, which reads it since content-api spec 012 (merged 2026-11-17). The SDK is headless: it sends the text and returns plain data; the cursor passes through unchanged. The SDK's own checks are settled from the contract and the SDK's existing rules (client checks only what the contract states exactly; the service is the final judge). It works through the script-tag loader's fetchPage command too. Version bump and README."

**Builds on**: [001-delivery-client](../001-delivery-client/spec.md) and [002-browser-loader](../002-browser-loader/spec.md) (both merged). **Contract read from** (read only): content-api `specs/012-search-q/contracts/search-v1.md` and `specs/009-public-delivery-endpoint/contracts/delivery-v1.md`.

The "user" is a **platform developer** who builds a page that shows content-api items with the platform's own components. Visitors never see the SDK; they type words in the platform's search box and see what the platform renders from the data it receives.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search a placement by words (Priority: P1)

A platform developer passes the text a visitor typed as `q` in the query of `fetchPage` and receives the matching items as plain data, in the order the service chose (best match first), with the cursor for the next page. Everything else about the call and the result is as before.

**Why this priority**: it is the whole feature; without it the platform cannot offer a search box on top of the SDK.

**Independent Test**: call `fetchPage` against a fake service with `q` set to `toyota corolla` and confirm the request carries that text as the `q` parameter, that the result holds the items the fake returned in the same order, and that a call without `q` sends no `q`.

**Acceptance Scenarios**:

1. **Given** a query with `q: "toyota corolla"`, **When** the SDK sends the request, **Then** the service receives `q` with exactly that text (spaces, Ethiopic letters and punctuation, symbols and quotes arrive as typed, safely encoded), and no other parameter the developer did not give.
2. **Given** a query without `q`, or with `q` undefined, **When** the SDK sends the request, **Then** no `q` is sent and the call is exactly what it was before this feature.
3. **Given** the service answers a search with an empty list, **When** the result is returned, **Then** it is a success with no items and no cursor, not an error.
4. **Given** `q` together with `limit`, `tags`, `languages` and `cursor`, **When** the SDK sends the request, **Then** all of them are sent, each in its own form.
5. **Given** Amharic text such as `መኪና ፡ ቶዮታ`, **When** it is sent, **Then** the service receives the same text after decoding.

---

### User Story 2 - Follow a search to the next page (Priority: P2)

A platform developer takes the cursor from a page of results and asks for the next page of the same search by passing the same `q` with the cursor. The SDK passes both through unchanged and does not remember anything between calls.

**Why this priority**: a search with many matches needs paging, but the first page already works without it.

**Independent Test**: with a fake service, fetch a first page with `q`, pass its cursor and the same `q` for the second, and confirm both are sent as given; a fake that refuses a cursor made for another `q` with `422` gives a `bad_query` error naming `cursor`.

**Acceptance Scenarios**:

1. **Given** a first page of a search with a next cursor, **When** the developer passes that cursor and the same `q`, **Then** the request carries both unchanged.
2. **Given** a cursor from one search used with another `q`, **When** the service refuses it with `422`, **Then** the result is the usual `bad_query` error with the field the service named, and the SDK makes no second attempt.

---

### User Story 3 - Search from a script tag (Priority: P2)

A platform that loads the SDK with the script tag calls the page-facing `fetchPage` command with `q` in its query, before or after the script has loaded, and gets the same result as a developer using the module.

**Why this priority**: the script tag is the way platforms are expected to load the SDK; search has to work there as well.

**Independent Test**: in the loader's browser-like test, queue a `fetchPage` command with `q` before load, run it after, and confirm the request carries `q`; call the exposed method directly with `q` and confirm the same.

**Acceptance Scenarios**:

1. **Given** a command queued before the script loaded, **When** it has `q` in its query, **Then** it is replayed with `q` and the callback receives the result.
2. **Given** the script has loaded, **When** the page calls `window.contentSdk.fetchPage` with `q`, **Then** the request carries `q`.

---

### User Story 4 - A bad search text is a typed error, not a throw (Priority: P2)

A `q` that cannot be sent (not text, or longer than the service allows) is reported as a typed `bad_query` error naming `q`, without sending a request. A text the service would refuse for its content (no word in it) is sent, and the service's refusal comes back as the usual `bad_query` error naming `q`.

**Why this priority**: the SDK never throws into a platform's page; a bad value must stay a result.

**Independent Test**: call `fetchPage` with `q` set to a number, an object, a list, and a 101-character text; each resolves to `{ ok: false, error }` with kind `bad_query` and `fields` naming `q`, and the fake service is never called.

**Acceptance Scenarios**:

1. **Given** `q` is not text (a number, an object, a list, `null`), **When** the call is made, **Then** the result is `bad_query` naming `q` and nothing is sent.
2. **Given** `q` has more than 100 characters after trimming (characters, not bytes), **When** the call is made, **Then** the same.
3. **Given** `q` of exactly 100 characters, **When** the call is made, **Then** it is sent.
4. **Given** `q` is empty or only spaces, **When** the call is made, **Then** it is treated as not given and no `q` is sent (a search box that is empty means no search).
5. **Given** a `q` made of symbols only, **When** the service answers `422`, **Then** the result is `bad_query` with the field the service named.

### Edge Cases

- A `q` with spaces at its ends is sent as given; the service trims it.
- A `q` of 100 characters that are two-byte or three-byte characters is allowed; the limit counts characters.
- A `q` holding `&`, `=`, `#`, `+`, `%`, quotes or a newline must arrive unchanged: it is encoded, never able to add or change another parameter.
- A `q` holding a lone surrogate (broken text) must not throw out of the SDK; it is a typed error or is encoded safely, never an uncaught error.
- The cursor is opaque and tied to the `q` it was made for; the SDK does not check that they agree.
- A service that does not know `q` yet (older than content-api spec 012) ignores it and returns the placement's usual page; the SDK cannot tell and does not try to.
- The result type is unchanged: the items hold the same nine fields, and nothing about the search (ranking, scores) is added by the SDK.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The query MUST accept an optional `q` of type text.
- **FR-002**: When `q` is given and holds anything other than spaces, the request MUST carry it as the `q` parameter with the text exactly as given, encoded so that no character of it can add, remove or change another parameter or the path.
- **FR-003**: When `q` is not given (absent, `undefined`), empty, or only spaces, the request MUST be exactly what it is without this feature, with no `q`.
- **FR-004**: A `q` that is not text, or has more than 100 characters after trimming (counted as characters, not bytes), MUST give a `bad_query` result with `fields` naming `q`, and MUST NOT send a request.
- **FR-005**: The SDK MUST NOT check what the service alone judges (whether the text holds a word). A `422` from the service for `q` MUST come back as the usual `bad_query` result with the field names the service gave.
- **FR-006**: `q` MUST work with `limit`, `tags`, `languages` and `cursor` in any combination, each sent as before.
- **FR-007**: The cursor MUST pass through unchanged; the SDK MUST NOT keep the last `q` or cursor between calls.
- **FR-008**: The script-tag loader's page-facing `fetchPage` MUST accept `q` in its query, for commands queued before load and calls after it, with the same result and error behavior.
- **FR-009**: The result MUST be unchanged in shape: the same page, items and error kinds; no new field, no new error kind.
- **FR-010**: Nothing in this feature may throw or reject into a platform's page (constitution I, the SDK's no-throw rule), including for text that is not valid.
- **FR-011**: The README MUST show the option, the limits, how to page a search (same `q` with the cursor) and that the service decides matching and order.
- **FR-012**: The package version MUST rise by one minor step (additive change); publishing the tag is the owner's act.

### Key Entities

- **Query** (existing): gains one optional field, `q`.
- No new entity, error kind or result field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the cases in the acceptance scenarios, the request address carries the exact expected `q` (checked on at least ten texts: plain, spaces, Amharic, each reserved character, 100 characters, quotes).
- **SC-002**: A call without `q` produces a byte-identical request address to before this feature in every existing test.
- **SC-003**: Every bad `q` in the scenarios resolves (never throws) and no request is made for the ones the SDK refuses.
- **SC-004**: The same `q` works through the module and through the script tag, in a queued command and in a direct call.
- **SC-005**: Against the hosted test service, one search for a word from an existing item returns it, and one for a missing word returns an empty page (optional live check, as in the earlier features).

## Assumptions

- **Empty text means no search.** `q: ""` or spaces only is treated as not given, as an empty cursor and an empty list already are in this SDK. The service itself refuses an empty `q`; the SDK does not pass that refusal on, because a visitor with an empty search box means "show everything". This can be reversed if the owner prefers to mirror the service.
- **The only client checks are the ones the contract states exactly**: text, and 100 characters after trimming. The word rule (letters and digits) is the service's, as the SDK's existing rule says (the service is the final judge).
- The name is `q` in the query, as the service parameter is, though the other fields are plural words (`tags`, `languages`): it is what a developer expects of a search, and it keeps the SDK's field and the service's parameter the same.
- The cursor is opaque and tied to the `q` it came from (service rule); keeping them together is the developer's job.
- The SDK does not mark, highlight or re-rank results; the service's order is final.
- content-api bumps its pinned SDK tag in its own later change, with the owner's go-ahead; until then the hosted script has no search option.
