# Feature Specification: Send the Platform's Own Key for an Event (eventId)

**Feature Branch**: `009-event-id`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Let a platform pass its own `eventId` to `watchView` and `trackLinkClick`, and send it as `event_id`, so the service stores a repeated event once. The service has deduplicated by a sender-chosen `event_id` since its spec 016, but the SDK has no way to send one, so a platform that calls `watchView` or `trackLinkClick` twice for the same thing (a re-render, a repeated call) stores two rows and cannot prevent it. The first user is Listings (platform id `listings`), which reports views and clicks for its own items and for Telegram posts."

**Builds on**: [005-session-id](../005-session-id/spec.md) (an option the platform supplies per call, checked first, left out with one warning when bad) and [008-external-ref-events](../008-external-ref-events/spec.md) (item and reference events, v0.8.0). **Contract read from** (read only): content-api `specs/016-event-dedup/contracts/events-v1-delta.md` and that spec's `research.md` (R1, R5, R6).

**Why**: the service stores one event per `(platform, event_id)` and ignores every later one with the same key, in a batch, across batches and concurrently, but only for an event that carries a key. The SDK never retries (one beacon, or one fetch if the beacon is missing) and `watchView` reports once per watch, so a duplicate comes from the platform's own repeated calls, or from a browser or network replaying a request. The platform is the only party that knows two calls are about the same event, so it must be able to say so: by passing the same key on the repeat.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform gives an event its own key (Priority: P1)

A platform calls `watchView(element, item, { eventId })` or `trackLinkClick(item, { eventId })` (an item with an `id` or an `{ externalRef }`) with a key it chose. The SDK sends it with the event as `event_id`, exactly as given.

**Why this priority**: it is the whole feature; without it a platform cannot prevent a repeated call from storing twice.

**Independent Test**: with a fake transport, a view and a click, for an item and for a reference, each reported with `eventId: "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b"` produce one event whose `event_id` is that text; an event with no `eventId` has no `event_id` key.

**Acceptance Scenarios**:

1. **Given** `trackLinkClick(item, { eventId: "k-1" })`, **When** the event is sent, **Then** it carries `event_id: "k-1"` and nothing else about it changes.
2. **Given** `watchView(element, item, { eventId })`, **When** the view is reported, **Then** the event carries that `event_id`.
3. **Given** `trackLinkClick({ externalRef }, { eventId })`, **When** it is sent, **Then** the reference event carries `event_id` beside `external_ref`.
4. **Given** the same `eventId` passed on two calls, **When** both are sent, **Then** both carry it and both are sent (the service, not the SDK, stores one: the SDK deduplicates nothing).
5. **Given** the script-tag command form (`window.contentSdk.q.push(["trackLinkClick", item, { eventId }])`), **When** it runs, **Then** it behaves as the direct call does.

---

### User Story 2 - Calls without an eventId behave as before (Priority: P1)

A platform that sends no `eventId` gets exactly the events and behaviour of v0.8.0: no `event_id` key, no warning, no change.

**Why this priority**: existing platforms must not be touched.

**Independent Test**: every existing events test passes unedited; an event with no `eventId` is byte for byte what v0.8.0 sent.

**Acceptance Scenarios**:

1. **Given** options without `eventId` (or no options), **When** the event is built, **Then** it has no `event_id` and no warning.
2. **Given** `eventId: undefined` or `eventId: null`, **When** the event is built, **Then** it is treated as absent and nothing is printed.

---

### User Story 3 - A bad key is left out with one warning, never shown (Priority: P2)

An `eventId` the service would refuse (not text, empty, longer than 128 characters, or holding any character outside `A-Za-z0-9_.:-`, a slash included) is left out of the event with one plain warning that names the problem and never prints the value, and the event is still sent without a key, as the SDK already does for a bad `sessionId`, `actorRef` and `placementId`. The service refuses a whole batch for one bad key, so checking first protects the other events (research R4 of spec 004).

**Why this priority**: one bad key would lose every event batched with it.

**Independent Test**: `eventId` of `""`, 129 characters, `"a b"`, `"a/b"`, `"é"`, `"a\u0000b"`, `7`, `{}` and a getter that throws each give an event without `event_id`, one warning that does not contain the value, no throw, and the event is still reported.

**Acceptance Scenarios**:

1. **Given** an invalid `eventId`, **When** the event is built, **Then** the event is reported without `event_id`, with one warning saying it was left out and the rule.
2. **Given** an `eventId` of exactly 128 characters, **When** the event is built, **Then** it is kept.
3. **Given** a key that differs only in case from another, **When** both are sent, **Then** each is sent as given.

---

### User Story 4 - The SDK makes no key of its own (Priority: P2)

The SDK never invents, stores or remembers an event key, and does not skip a call it has seen before: no random source, no storage, no cookie, no module-level memory. A key the SDK sends is always one the platform handed it for that call, and a repeated call without a key is reported again.

**Why this priority**: a key made per call would be new each time and deduplicate nothing; a memory of what was reported is a client-side counting rule the owner has not chosen (constitution I and VI).

**Independent Test**: a call with an `eventId` followed by one without sends the key only on the first; a full lifecycle reads and writes no storage, cookie or random source; the same call made twice with no key sends two events.

**Acceptance Scenarios**:

1. **Given** a call with an `eventId` then a call with none, **When** both events are built, **Then** only the first carries one.
2. **Given** the same item reported twice with no key, **When** the batch is sent, **Then** it holds two events.

---

### User Story 5 - The platform is told what a key is and how to choose one (Priority: P2)

The README and the SDK's events contract say what an `eventId` is and is not, and how to use it so a repeat is stored once.

**Why this priority**: the SDK cannot check that a key is used well; the guidance is the only protection, and a wrong key (a fresh random one per call, or one built from public values) silently does nothing or helps a forger.

**Independent Test**: the README and the events contract contain every statement below.

**Acceptance Scenarios**:

1. **Given** the README, **When** a platform developer reads the events section, **Then** it says: an `eventId` is one event's key, not a visit's (that is `sessionId`) and not a user's (that is `actorRef`); to make a repeated call store once, pass the same `eventId` on the repeat (for example a key the platform stores with the post it already reported); a fresh random key per call deduplicates nothing; give each event its own key (a view and a click of one thing need two keys, and one key for two different events drops the second); do not build a key from public values only, because a forged event with the same key would block yours, so use a random UUID the platform keeps, or a value it derives that others cannot; the first stored event with a key wins and a repeat changes nothing; the key space is one per platform across item and reference events; raw counts stay raw and are not for billing, and an `eventId` removes repeats of one event, not repeated visits.

---

### Edge Cases

- A key is never printed in a warning, log line or error.
- An `eventId` equal to the `sessionId` or the `actorRef` is allowed and sent as given; the three are separate fields.
- A reference event and an item event with the same `eventId` share one key on the service (the first stored wins); the SDK does nothing about it.
- An event the service drops by its rules (inactive item, unknown or disabled placement) does not use up its key; nothing for the SDK to do.
- The service ignores an unknown field, so a platform that sends `eventId` to a service older than its spec 016 simply has no deduplication; this is not an SDK error.
- `placementId`, `actorRef`, `sessionId` and the item or reference rules keep their rules; a bad `eventId` never affects them, and a bad one of them never affects it.
- The options object that is not an object is ignored with the existing warning, so no `eventId` is read from it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The options of `watchView` and `trackLinkClick` (library, script-tag commands and queue) MAY carry `eventId`: text of 1 to 128 characters of `A-Za-z0-9_.:-`, the platform's key for this event. It is optional; `undefined` and `null` count as absent.
- **FR-002**: A valid `eventId` MUST be sent with its event as `event_id`, exactly as given (case kept), for item events and reference events alike; an event with none MUST have no `event_id` key.
- **FR-003**: An invalid `eventId` (not text, empty, over 128 characters, or with a character outside the set, a slash included) MUST be left out with one plain warning that names the problem and never repeats the value, and the event MUST still be reported.
- **FR-004**: The SDK MUST NOT generate, store, remember or default a key, MUST NOT skip or merge calls it has seen before, and MUST NOT use browser storage, a cookie, a random source or module-level state for this; a call's `eventId` applies to that call's event only.
- **FR-005**: Everything else MUST stay as v0.8.0 has it: the events' other fields, item and reference events, batching, the transport and its no-retry rule, the view and click rules, the warnings for other options, `fetchPage`, the loader's settings and the bundle's shape; no new setting, dependency or public export; existing tests pass unedited except where a task names the exact lines.
- **FR-006**: The README, the events contract in this repository and the CLAUDE.md status MUST describe `eventId` and carry the guidance of User Story 5.
- **FR-007**: The package version becomes `0.9.0`; the owner tags the release after the merge, and content-api takes it in a pin-bump spec of its own.
- **FR-008**: The contract tests MUST run the SDK's events against the shape in content-api's events delta (`event_id` present and valid, absent, and with item and reference events).

### Key Entities

- **Event key**: opaque text the platform chose for one event. The SDK passes it through and never interprets it.
- **Event (as sent)**: the existing event record with one more optional key, `event_id`, present only when the platform gave a valid `eventId` for that call.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test of 50 events (item and reference, views and clicks) across 5 keys, each sent event carries the `event_id` of its own call.
- **SC-002**: Every events test of v0.8.0 passes unedited, and an event with no `eventId` is byte for byte what v0.8.0 sent.
- **SC-003**: Every invalid key tested (empty, 129 characters, space, slash, accented letter, NUL, number, boolean, object, list, throwing getter) is left out with one warning, none throws, and the event is still reported.
- **SC-004**: No warning, log line or error produced in any test contains a key value the platform gave.
- **SC-005**: In a test of a full reporting lifecycle, zero reads or writes of storage, cookies or random sources come from the SDK, and the same call made twice with no key sends two events.
- **SC-006**: The built browser script grows by no more than 1 KB (minified) over v0.8.0.

## Assumptions

- **Bad key: leave it out and still send** (decided here from spec 005, owner to confirm before the plan). The point of a key is to store once, and an event sent without it can be stored twice; but refusing the event would lose it, and a bad key reaching the service would refuse the whole batch. The SDK follows the rule it already has for every bad option (leave out, warn once, send), so one habit covers all options. The alternatives (record nothing, or send the bad key and let the service refuse the batch) go in `research.md`.
- The platform supplies the key on each call; it has a stable value for "this thing was already reported" (for example a key it stores with the post) or no deduplication. The SDK does not make one.
- An SDK-generated key per event was considered and is not part of this spec: the SDK never retries and each call would get a new key, so it would deduplicate nothing a platform does twice. It would help only if the SDK later retries or a browser replays a request, and it would be the SDK's first random source. It can be added later with the owner's decision.
- Remembering in memory what was already reported in a page load, and skipping repeats, was considered and is not part of this spec: it changes behaviour (a legitimate second click would be lost), lasts only one page load, and is a client-side counting rule that needs the owner's decision.
- The service validates the key again (content-api spec 016); the SDK checks first so a bad value never refuses a batch.
- Out of scope: any change to content-api, counting rules (per session or person), ranking, reading events back, rate limiting, an SDK-generated key, retries in the transport, and how Listings builds its pages.
- Nothing is pushed, merged, tagged or published without the owner's go-ahead; the owner tags the release after the merge, and content-api takes the new version in a separate spec.
