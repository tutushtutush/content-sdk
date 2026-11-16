# Feature Specification: Delivery Client

**Feature Branch**: `001-delivery-client`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Delivery client: a headless function set that reads content-api's public delivery endpoint. A platform gives a base address, platform id and placement id; the client fetches a page of items (optional limit, tag, language), follows the next-page cursor, and returns plain data. Typed errors for unknown placement, origin not allowed, bad query, network failure, and a response that does not match the contract; it never throws raw. Validates the response shape, ignores unknown fields, treats all text as untrusted. No runtime dependencies, works in browsers and Node 22."

**Contract read from**: content-api `specs/009-public-delivery-endpoint/contracts/delivery-v1.md` and `specs/010-item-link-out/contracts/item-url.md` (read only).

## User Scenarios & Testing *(mandatory)*

The "user" of this feature is a **platform developer** who builds a page that shows content-api items with the platform's own components. Visitors never see the SDK; they see what the platform renders from the data it returns.

### User Story 1 - Fetch a page of items (Priority: P1)

A platform developer gives the client the service's base address, the platform id and the placement id, and gets back a page of items as plain data, plus the cursor for the next page (or none). They can narrow the page with an optional limit, tag list and language list.

**Why this priority**: This is the whole reason the SDK exists. Without it nothing else has value; with only this, a platform can already show a list.

**Independent Test**: Run the client against a fake that answers with the contract's example body and confirm the result holds the items exactly as nine plain fields and the cursor. Optionally run it once against the hosted test service (platform `listings`, placement `latest`).

**Acceptance Scenarios**:

1. **Given** a platform and placement that exist, **When** the developer fetches with no options, **Then** they receive the items in the order the service sent them and a next cursor that is either text or none.
2. **Given** a placement that holds no items, **When** the developer fetches, **Then** they receive an empty list and no cursor, and this is a success, not an error.
3. **Given** the developer asks for a limit, tags and languages, **When** the client sends the request, **Then** the service receives exactly those values in the form the contract defines, and options the developer did not give are not sent.
4. **Given** an item whose link-out address is missing a value (`null`) or whose images list is empty, **When** the page is returned, **Then** those items are returned as they are, with no link and no images.
5. **Given** the service later adds a field to the response or to an item, **When** the developer fetches, **Then** the unknown field is not returned and nothing fails.

---

### User Story 2 - Follow the cursor to the next page (Priority: P2)

A platform developer takes the next cursor from one page and asks for the page after it, with the same filters, until the service says there are no more.

**Why this priority**: A single page is enough for a first list; paging is what makes the SDK useful for longer lists, but it builds directly on Story 1.

**Independent Test**: Run the client against a fake that serves three pages in order; confirm that passing each returned cursor yields the next page and that the last page has no cursor.

**Acceptance Scenarios**:

1. **Given** a page with a next cursor, **When** the developer asks for the next page with that cursor, **Then** the request carries the cursor unchanged and the next page is returned.
2. **Given** the last page, **When** it is returned, **Then** its cursor is none and the developer knows to stop.
3. **Given** a cursor the service refuses (for example, used with different filters), **When** the developer asks, **Then** they receive the bad-query error and not a thrown exception.

---

### User Story 3 - Handle every failure as a typed, readable error (Priority: P2)

When something goes wrong, the platform developer receives a typed error they can branch on: unknown placement, origin not allowed, bad query, service unavailable, network failure, or a response that does not match the contract. The client never throws a raw exception, never hangs on a bad answer, and never exposes service text in a way that could be mistaken for markup.

**Why this priority**: Platforms run on visitors' devices and flaky networks; a page that breaks on the first error is worse than one with no content. It is required for a safe release but can be built after the success path.

**Independent Test**: Drive the client with a fake for each failure (404, 403, 422, 503, a network failure, a malformed body, a wrong shape) and confirm each gives its own error kind and none throws.

**Acceptance Scenarios**:

1. **Given** the platform or placement does not exist or is switched off, **When** the developer fetches, **Then** they receive the unknown-placement error.
2. **Given** the page's origin is not on the platform's allowed list, **When** the developer fetches, **Then** they receive the origin-not-allowed error.
3. **Given** a limit outside the allowed range, a malformed tag or language list, or a refused cursor, **When** the developer fetches, **Then** they receive the bad-query error naming the parameter the service named.
4. **Given** the service cannot reach its database (503) or answers with a status the contract does not list, **When** the developer fetches, **Then** they receive a service-unavailable error that is separate from the contract-mismatch error.
5. **Given** the network fails, the connection drops or the request is cancelled, **When** the developer fetches, **Then** they receive the network error.
6. **Given** the service answers `200` with a body that is not valid, is missing required fields, or has a field of the wrong type, **When** the developer fetches, **Then** they receive the contract-mismatch error and no partial items.
7. **Given** any failure, **When** the developer reads the error, **Then** they can tell the kind without parsing a message, and the original cause is kept for debugging.

---

### User Story 4 - Safe by default with untrusted text (Priority: P2)

A platform developer can pass what the client returns to their own components without the SDK having built markup, touched the page, or accepted anything outside the contract's rules.

**Why this priority**: Delivery carries text written by strangers. Platform safety rests on the first code that sees it checking its shape.

**Independent Test**: Feed the client items whose title, description, tags and addresses contain markup, script text, control characters, very long strings and wrong-type values; confirm that valid-shaped text is returned unchanged as plain text, and any wrong shape is a contract-mismatch error.

**Acceptance Scenarios**:

1. **Given** an item whose title or description contains markup, **When** it is returned, **Then** the text is returned exactly as received, as plain text, with nothing created, escaped, stripped or rendered.
2. **Given** an item whose link-out address or image address is not an `http` or `https` address, **When** the page is validated, **Then** it is treated as a contract mismatch rather than passed on as a link.
3. **Given** a platform that runs the client in a browser or in Node 22, **When** it fetches, **Then** the same calls give the same results, and the client needs no page, no document and no extra packages.

---

### Edge Cases

- A limit of 0, 51, a fraction or a negative number: the client refuses it as a bad-query error before sending, or the service refuses it; either way the developer gets the bad-query error and never a raw exception.
- An empty tag or language list is the same as none and is not sent.
- A tag or language list over 50 values or a value that breaks the contract's character rules: bad-query error.
- A base address given with or without a trailing slash, or with a path prefix: both give the same request address. A base address that is not a valid `http` or `https` address is a developer mistake reported as a typed error, not a thrown exception.
- Platform id or placement id containing characters that would change the request path (`/`, `?`, `#`, spaces): they are encoded into the path, never allowed to alter it.
- A `200` answer whose `items` is not a list, whose `next_cursor` is neither text nor null, or whose item is missing any of the nine fields: contract mismatch.
- A `200` answer with an empty `items` list and a non-null cursor: returned as is; the contract does not forbid it and the client does not guess.
- A very large or slow response: the client stops waiting when the caller cancels or a time limit the caller sets is reached, and reports the network error.
- An error body that is not in the contract's error shape (a proxy page, plain text): the client still returns the typed error for the status, and uses no text from the body as markup.
- The page's origin is refused (403): the browser may hide the body; the client reports origin-not-allowed when it can tell, and the network error otherwise.
- A redirect, a `304` or any status the contract does not list: service-unavailable error (see Assumptions).
- The service sends a cursor longer than the 512 characters it accepts back: returned as is; the service decides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client MUST let a platform give a base address, platform id and placement id, and MUST request the placement's delivery page from the service's version-1 public delivery address built from them.
- **FR-002**: The client MUST accept an optional limit, an optional list of tags and an optional list of languages, and MUST send only the ones the developer gave, in the form the contract defines (comma-separated lists, limit as a whole number).
- **FR-003**: The client MUST accept an optional cursor and send it unchanged; it MUST NOT read, build or modify a cursor.
- **FR-004**: On success the client MUST return the items in the order received and the next cursor (text, or none when there are no more pages), as plain data with no methods, classes with behavior or hidden state.
- **FR-005**: Each returned item MUST carry exactly the nine contract fields: id, platform, title, description, language, tags, images, created time and link-out address. The link-out address is text or none; images is a list that may be empty, each with an address.
- **FR-006**: The client MUST validate the answer's shape before returning anything and MUST ignore fields it does not recognise, at the top level and inside each item and image, without error and without returning them.
- **FR-007**: The client MUST return a typed error of its own kind for each of: unknown placement (404), origin not allowed (403), bad query (422), service unavailable (503 and any other status the contract does not list), network failure, contract mismatch (answer does not match the contract), and invalid target (base address, platform id or placement id refused before sending).
- **FR-008**: The client MUST NOT throw or reject with a raw exception for any outcome of a request, including a network failure, a body that cannot be read, or a cancelled request; every outcome is a returned success or a returned typed error.
- **FR-009**: A bad-query error MUST carry the parameter names the service reported, when it reported any.
- **FR-010**: Every error MUST carry its kind, a short message written by the SDK, the HTTP status when there is one, and the original cause when there is one. Text taken from the service MUST be kept as plain data and MUST NOT be the only way to tell the kind.
- **FR-011**: The client MUST treat all text received (titles, descriptions, tags, addresses, error messages) as untrusted: it MUST NOT build markup from it, MUST NOT create or touch any document element, MUST NOT evaluate it, and MUST NOT change it.
- **FR-012**: The client MUST accept as a link-out address or image address only an absolute `http` or `https` address, or none for the link-out address; any other value is a contract mismatch.
- **FR-013**: The client MUST send no credential, no cookie and no custom request header, so a browser request stays a simple cross-origin read.
- **FR-014**: The client MUST let the caller supply the function that performs the network request, defaulting to the environment's own, so tests and other runtimes need no global replacement.
- **FR-015**: The client MUST let the caller cancel a request, and MUST report a cancelled request as the network error with a way to tell cancellation from a failure.
- **FR-016**: The client MUST work unchanged in current browsers and in Node 22, MUST have no runtime dependencies, and MUST NOT require a page, a document or any global other than the standard request function and address and abort facilities.
- **FR-017**: The client MUST refuse, before any request is sent, input it can see is wrong (a limit that is not a whole number from 1 to 50, a base address that is not an `http` or `https` address, an empty platform or placement id), returning the bad-query error or a typed input error rather than throwing.
- **FR-018**: The client's public surface (its calls, inputs, outputs and error kinds) MUST be documented and kept small, with each element required by a requirement here.
- **FR-019**: Contract tests MUST run the client against the response and error shapes in content-api's contract files, including the example answer.

### Key Entities

- **Item**: One piece of content as the service delivers it: id, owning platform, title, description, language, tags, images, created time and an optional link-out address. Plain data; a platform decides how to show it. Nothing is added to it and nothing is removed.
- **Image**: An address of a picture for an item. An item has none, one or several.
- **Page**: A list of items plus the next cursor (text) or none. The result of one fetch.
- **Cursor**: An opaque piece of text that marks where the next page starts. Meaningful only to the service, and only for the same placement and filters.
- **Delivery target**: The base address of the service plus the platform id and placement id the platform was given.
- **Query options**: The optional limit, tags, languages and cursor for one fetch.
- **Delivery error**: A typed failure: its kind, a short message, the status when there is one, the parameters named by a bad query, and the cause.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform developer can show a first page of items from a placement using one call after giving the three identifiers, with no setup step beyond those.
- **SC-002**: For every contract case in content-api's delivery and link-out contracts (success, empty page, 404, 403, 422, 503), the client's test suite has a passing test, and the same suite passes in a Node 22 environment and in a browser-like test environment (the real browser is checked by hand, SC-007).
- **SC-003**: In a test that drives the client with at least 20 different broken outcomes (network failure, cancelled request, malformed body, wrong types, missing fields, unexpected status), 100% return a typed error and 0 throw or reject.
- **SC-004**: When the service adds new fields to the response or to items, 100% of existing tests still pass and none of the new fields appear in returned data.
- **SC-005**: A developer can walk a placement of several pages to the end, following the cursor, and see every item once, in the order the service sent them.
- **SC-006**: The shipped package has zero runtime dependencies and its code creates no markup and touches no document.
- **SC-007**: The same calls run against the hosted test service (platform `listings`, placement `latest`) return a valid page, confirming the client matches the live contract. The automated live check sends no origin (which the contract serves); the allowed-origin path is checked by hand in a real browser from `https://listings-test-nine.vercel.app`.

## Assumptions

- **Audience**: platform developers, not end visitors. "Users" in the scenarios are developers who write the platform's page code.
- **Service answers that the contract does not list** (a redirect, 304, 400, 500, 502): reported as the service-unavailable error with the status, since the client cannot tell more and the platform's right response is the same (try later, show nothing).
- **Cancellation and time limits** are the caller's to give (a cancel signal; a time limit they build from it). The client has no default time limit of its own and no retry; retries are the platform's choice.
- **Origin** is set by the browser; the client never sets it. A server-side caller sends no origin and is served, per the contract.
- **Input checks before sending** cover only what the contract states exactly (limit 1 to 50, tag and language rules, list sizes). The service stays the final judge; if the client's check and the service disagree, the service's answer wins.
- **Time and order**: items keep the service's order and the created time is passed on as the text the service sent, not turned into a date; the platform formats it.
- **Language and tag values** are returned as received; the client does not change case or normalise them.
- **The public shape of the SDK** (function names, option names, how results and errors are returned, ESM and CommonJS entry points, the bundle) is decided in the plan with the owner, not here.
- **Out of scope**: rendering and components, infinite-scroll or other UI, events, ranking, search, caching, the loader tag and slots, publishing to npm, and anything in content-api or listings.
- **Dependencies**: content-api's version-1 delivery endpoint and its two contract files; the hosted test service for one live check.
