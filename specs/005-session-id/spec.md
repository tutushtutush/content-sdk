# Feature Specification: Report the Visit with a Session Id

**Feature Branch**: `005-session-id`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "content-api now accepts an optional `session_id` on each event of `POST /api/v1/events` (content-api spec 017, merged 2026-11-17): opaque text of 1 to 128 characters with no NUL, kept as sent, `null` or omitted meaning none, a bad value refusing the whole batch with `422 invalid`. It is the visit an event belongs to, so counting and ranking can later tell separate visits apart. The SDK lets the platform say which visit a reported view or click belongs to, through a `sessionId` option beside `placementId` and `actorRef`, and sends it as `session_id`. The platform supplies it; the SDK makes none, stores none and has no default. No event id is added (the SDK does not retry, so a key would dedupe nothing)."

**Builds on**: [004-view-events](../004-view-events/spec.md) (merged, v0.4.0). **Contract read from** (read only): content-api `specs/017-event-session-id/contracts/events-v1-delta.md`, which amends `specs/014-save-events/contracts/events-v1.md` (and `specs/016-event-dedup/contracts/events-v1-delta.md` for `event_id`).

**Why**: the service now stores a visit reference on every event, but it can only record one the sender sends, and what an event does not carry when it is stored can never be added later. A page that reports a view ten times in one visit should count as one visit, which counting can do only if each event says which visit it came from. The platform knows its own visits (its cookie, its session, its page flow); the SDK does not, and must not invent one (constitution I and VI). So the platform hands the SDK the id it already has.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform says which visit a view or click belongs to (Priority: P1)

A platform calls `watchView(element, item, { sessionId })` or `trackLinkClick(item, { sessionId })` with a value that names the current visit. The SDK sends it with the event as `session_id`, exactly as given.

**Why this priority**: it is the whole feature. Without it the SDK cannot supply the field the service now stores.

**Independent Test**: with a fake transport, a view reported with `sessionId: "s-7f3a"` produces one event whose `session_id` is `"s-7f3a"`; the same for a link click; an event sent with no `sessionId` has no `session_id` key.

**Acceptance Scenarios**:

1. **Given** `trackLinkClick(item, { sessionId: "s-7f3a" })`, **When** the event is sent, **Then** it carries `session_id: "s-7f3a"` and nothing else about it changes.
2. **Given** `watchView(element, item, { sessionId })`, **When** the view is reported, **Then** the event carries that `session_id`.
3. **Given** several events reported with the same `sessionId`, **When** they are batched and sent, **Then** each carries it, and they stay separate events.
4. **Given** the script-tag command form (`window.contentSdk.q.push(["trackLinkClick", item, { sessionId }])`), **When** it runs, **Then** it behaves as the direct call does.

---

### User Story 2 - Calls without a session id behave as before (Priority: P1)

A platform that sends no `sessionId` gets exactly the events and behaviour of v0.4.0: no `session_id` key, no warning, no change.

**Why this priority**: existing platforms must not be touched by this change.

**Independent Test**: every existing events test passes unedited; an event with no `sessionId` is byte for byte what v0.4.0 sent.

**Acceptance Scenarios**:

1. **Given** options without `sessionId` (or no options), **When** the event is built, **Then** it has no `session_id` and no warning is printed.
2. **Given** `sessionId: undefined`, **When** the event is built, **Then** it is treated as absent.
3. **Given** `sessionId: null`, **When** the event is built, **Then** it is treated as absent and nothing is printed.

---

### User Story 3 - A bad session id is left out, and the rest is still reported (Priority: P2)

A `sessionId` the service would refuse (empty, longer than 128 characters, holding a NUL character, or not text) is left out of the event with one plain warning, so the rest of the batch is not refused by the service for one bad value, as the SDK already does for `actorRef` and `placementId`.

**Why this priority**: the service refuses a whole batch for one bad field; checking first protects the other events (research R4 of spec 004).

**Independent Test**: events built with `sessionId` of `""`, 129 characters, `"a\u0000b"`, `7`, `{}` carry no `session_id`, print one warning each, and are still reported.

**Acceptance Scenarios**:

1. **Given** an invalid `sessionId`, **When** the event is built, **Then** the event is reported without `session_id`, and one warning says it was left out and why, without repeating the value.
2. **Given** a `sessionId` whose property cannot be read (a getter that throws), **When** the event is built, **Then** it is left out with a warning and nothing throws.
3. **Given** a `sessionId` of exactly 128 characters, counted as characters, **When** the event is built, **Then** it is kept.

---

### User Story 4 - The SDK makes no session of its own (Priority: P2)

The SDK never invents, stores or remembers a session id: no cookie, no storage, no module-level value that outlives a call. A session id the SDK sends is always one the platform handed it for that call.

**Why this priority**: constitution I forbids the SDK to own event data beyond what it passes through, and VI forbids options in advance; a generated default is the one part of this feature that would be new state.

**Independent Test**: a test environment with spies on storage, cookies and random-number sources shows none is touched; two calls, one with a `sessionId` and one without, show the second carries none (nothing is remembered between calls).

**Acceptance Scenarios**:

1. **Given** a call with a `sessionId` followed by a call with none, **When** both events are built, **Then** only the first carries one.
2. **Given** a full page lifecycle (watch, report, page hidden), **When** the events are sent, **Then** no browser storage, cookie or random source was read or written by the SDK.

---

### Edge Cases

- A `sessionId` equal to the event's `actorRef` is allowed and sent as given; the two are separate fields.
- A `sessionId` is sent as given: case, spacing and characters are not changed; length is counted in characters.
- `placementId` and `actorRef` keep their rules; a bad `sessionId` never affects them, and a bad one of them never affects it.
- The options object that is not an object is ignored with the existing warning, so no `sessionId` is read from it.
- A platform that sends `sessionId` to a service that has not yet taken spec 017 (a hosted service older than the merge) would have the field ignored by the service (unknown fields are ignored); this is not an error in the SDK.
- The value is never printed in a warning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The options of `watchView` and `trackLinkClick` MAY carry `sessionId`: text of 1 to 128 characters (counted as characters) with no NUL, the visit the event belongs to. It is optional; `undefined` and `null` count as absent.
- **FR-002**: A valid `sessionId` MUST be sent with its event as `session_id`, exactly as given; an event with none MUST have no `session_id` key.
- **FR-003**: An invalid `sessionId` (empty, over 128 characters, holding a NUL, not text, or unreadable) MUST be left out of the event with one plain warning that never repeats the value, and the event MUST still be reported, as for `actorRef`.
- **FR-004**: The script-tag command form MUST accept the same option and behave as the direct call does.
- **FR-005**: The SDK MUST NOT generate, store, remember or default a session id: no browser storage, cookie, random source or module-level state is used for it, and a call's `sessionId` applies to that call's event only.
- **FR-006**: Everything else about reporting MUST stay as v0.4.0 has it: the events' other fields, batching, the transport, the view rule, the click rule, the warnings for other options, the loader and its commands.
- **FR-007**: No `event_id` is added or sent (the SDK does not retry, so a key would deduplicate nothing, and no requirement needs one yet).
- **FR-008**: The SDK's own contract documents (its README and the events contract in this repository) MUST describe `sessionId`, its rule, that the platform supplies it, and that it should be a random or hashed value, never an email, a name or anything that identifies a person.
- **FR-009**: The package version becomes `0.5.0` and the built script and typed entry points expose the new option; the owner tags the release after the merge, and content-api takes it in a later spec of its own.
- **FR-010**: The contract tests MUST run the SDK's events against the shape in content-api's events contract, `session_id` included, and an event with no session id against the v0.4.0 shape.

### Key Entities

- **Event (as sent)**: the existing event record with one more optional key, `session_id`, present only when the platform gave a valid `sessionId` for that call.
- **Session id**: opaque text the platform chose for a visit. The SDK passes it through and never interprets it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test of 50 events reported across 5 `sessionId` values, each sent event carries the `session_id` of its own call.
- **SC-002**: Every events test of v0.4.0 passes unedited, and an event with no `sessionId` is byte for byte what v0.4.0 sent (SC-003 of spec 004's shape).
- **SC-003**: Every invalid `sessionId` tested (empty, 129 characters, NUL, number, boolean, object, list, throwing getter) is left out with one warning, none throws, and the event is still reported.
- **SC-004**: No warning, log line or error produced in any test contains a `sessionId` value the platform gave.
- **SC-005**: In a test of a full reporting lifecycle, zero reads or writes of storage, cookies or random sources come from the SDK.
- **SC-006**: The built browser script grows by no more than 1 KB (minified) over v0.4.0.

## Assumptions

- The platform (listings) has a notion of a visit or session and can pass a random or hashed id for it on each call; the SDK makes none. If a platform has none, it passes none and its events carry none, as today.
- Generating a default session id in the SDK (in memory per page load, or in `sessionStorage` per tab) was considered and is not part of this spec: it would be event data the SDK originates (constitution I) and, for storage, its first use of browser storage. It can be added later, additively, with the owner's decision and a constitution reading.
- No `eventId` option: the SDK does not retry (its transport never resends), so a key would deduplicate nothing; a platform whose own server retries uses content-api's `event_id` there. A requirement would add it later.
- The service validates the value again (content-api spec 017); the SDK checks first so a bad value never refuses a batch.
- Nothing is pushed, published or tagged without the owner's go-ahead; the owner tags the release after the merge, and content-api takes the new version in a separate spec.
- The README of the SDK already says `actorRef` can hold "a device or session id"; this spec keeps `actorRef` as the user or device and gives the visit its own option, as the service does.
