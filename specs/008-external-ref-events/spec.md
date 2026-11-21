# Feature Specification: Report Events About Things That Are Not Items (External Reference)

**Feature Branch**: `008-external-ref-events`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Let `watchView` and `trackLinkClick` report an event about something that is not a content-api item, by an opaque external reference instead of an item id. Requested by the Listings project (platform id `listings`, 2026-11-20) for its page of Telegram posts, which it reads live and deliberately does not store as items. The service side is built and merged (content-api spec 022, PR #34, merge commit 61d0130)."

**Builds on**: [004-view-events](../004-view-events/spec.md) (events) and [005-session-id](../005-session-id/spec.md) (the option style). **Contract read from** (read only): content-api `specs/022-external-ref-events/contracts/events-v1-delta.md` (with that spec's `spec.md` and `research.md` R1, R2, R4, R5), which amends `specs/014-save-events/contracts/events-v1.md`.

**Why**: a platform can only report views and clicks for items that content-api stores. Listings shows posts it reads live and keeps nowhere, so it has no item id to report. The service now accepts an event that names such a thing by a label the platform chooses (an external reference). It refuses a whole batch if one event has both an item id and a reference, or neither, or a reference that breaks its rule, so the SDK must check first and send nothing bad (research R4 of spec 004).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform reports a view or click about something it does not store (Priority: P1)

A platform calls `watchView(element, { externalRef: "telegram:addis_news/10234" }, options)` or `trackLinkClick({ externalRef: "telegram:addis_news/10234" }, options)`. The event sent carries `external_ref` with that text and no `item_id`. `placementId`, `actorRef` and `sessionId` work as they do for items.

**Why this priority**: it is the whole feature; without it Listings cannot report anything for its Telegram page.

**Independent Test**: with a fake transport, a view and a click reported with an `externalRef` each produce one event with `external_ref` set to the given text and no `item_id` key, and with the options' fields as for an item event.

**Acceptance Scenarios**:

1. **Given** `trackLinkClick({ externalRef: "telegram:addis_news/10234" }, { placementId: "telegram", sessionId: "s-1" })`, **When** the event is sent, **Then** it has `external_ref`, `placement_id` and `session_id`, and no `item_id`.
2. **Given** `watchView(element, { externalRef }, options)`, **When** the view rule is met, **Then** one view event with `external_ref` is reported, by the same rule as for an item.
3. **Given** the script-tag command form (`window.contentSdk.q.push(["trackLinkClick", { externalRef }, options])`, and the same for `watchView`), **When** it runs, **Then** it behaves as the direct call does.
4. **Given** events for items and for references in one batch, **When** it is sent, **Then** each event keeps its own identifying field and they stay separate events.
5. **Given** no `placementId`, **When** a reference event is built, **Then** none is sent: the SDK invents no placement.

---

### User Story 2 - Item events behave exactly as before (Priority: P1)

A platform that passes items with an `id` gets the events and behaviour of v0.7.0: same fields, same warnings, same refusals.

**Why this priority**: existing platforms must not be touched.

**Independent Test**: every existing events test passes unedited; an item event is byte for byte what v0.7.0 sent.

**Acceptance Scenarios**:

1. **Given** an item with a UUID `id` and no `externalRef`, **When** the event is built, **Then** it is as in v0.7.0, with no `external_ref` key.
2. **Given** an item whose `id` is missing or not a UUID and no `externalRef`, **When** the event is built, **Then** it is refused with the existing warning.

---

### User Story 3 - A bad reference is refused locally, once, without printing it (Priority: P1)

An `externalRef` the service would refuse (not text, empty, over 128 characters, or holding any character outside `A-Za-z0-9_.:/-`) records no event and gives one console warning that names the problem and never prints the value.

**Why this priority**: the service refuses the whole batch for one bad value, so one bad reference would lose other events.

**Independent Test**: references of `""`, 129 characters, `"a b"`, `"é"`, `"a\u0000b"`, `7`, `{}` and a throwing getter each record no event, print one warning that does not contain the value, and do not throw.

**Acceptance Scenarios**:

1. **Given** an invalid `externalRef`, **When** the call is made, **Then** no event is recorded, one warning is printed, and it does not repeat the value.
2. **Given** an `externalRef` of exactly 128 characters, counted as characters, **When** the call is made, **Then** it is kept.
3. **Given** `externalRef` with different case (`Telegram:A` and `telegram:a`), **When** sent, **Then** each is sent as given, never changed.

---

### User Story 4 - An item that names both or neither is refused (Priority: P1)

An item that carries both an `id` and an `externalRef`, or neither, records no event and gives one warning, because the service would refuse the whole batch. `null` for either counts as not given, as the service counts it. An `id` that is present but not a UUID, together with an `externalRef`, counts as both and is refused, so the SDK never sends both fields.

**Why this priority**: it is what keeps a batch from being refused as a whole.

**Independent Test**: items `{ id: uuid, externalRef }`, `{ id: "x", externalRef }`, `{}`, `{ id: null, externalRef: null }` each record no event and warn once; `{ id: null, externalRef }` and `{ id: uuid, externalRef: null }` are reported as reference and item events.

**Acceptance Scenarios**:

1. **Given** both an `id` and an `externalRef`, **When** the call is made, **Then** no event is recorded and one warning says the item must have one or the other.
2. **Given** neither, **When** the call is made, **Then** no event is recorded and one warning says so.
3. **Given** the types the SDK publishes, **When** a call passes an item with neither an `id` nor an `externalRef`, **Then** it fails to compile.

---

### User Story 5 - The platform is told what to put in a reference (Priority: P2)

The README and the SDK's events contract say that the platform must supply a stable reference made only of public identifiers (never an email, a name or anything that identifies a person), and must fix its format early, because changing it later splits one thing's events in two.

**Why this priority**: the service cannot check what the text means; the guidance is the only protection.

**Independent Test**: the README and events contract contain both statements and the rule for `externalRef`.

**Acceptance Scenarios**:

1. **Given** the README, **When** a platform developer reads the events section, **Then** they find the rule, the example `telegram:addis_news/10234`, the privacy statement and the format-stability warning.

---

### Edge Cases

- A reference event with a `placementId` the service does not know is dropped by the service with its usual 204; this is not an SDK error. Until the owner creates the `telegram` placement for `listings`, the service drops those events.
- Reference events carry no `item_id`; reading events back, counting and ranking by reference are not part of this feature.
- A reference is never printed in a warning, log line or error.
- An item that cannot be read (a throwing getter) keeps the existing "could not be read" warning.
- Two platforms using the same reference text are unrelated; the SDK does nothing about it.
- The SDK does not look at what the reference means (for example the `telegram:` prefix); it has no allowed-prefix rule, as the service has none.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `watchView` and `trackLinkClick` (library and script-tag commands) MUST accept, in place of an item with an `id`, an object with an `externalRef`; the event sent MUST then carry `external_ref` and no `item_id`.
- **FR-002**: `externalRef` MUST be validated locally: text, 1 to 128 characters counted as characters, only `A-Za-z0-9_.:/-`. A valid one is sent exactly as given.
- **FR-003**: An invalid `externalRef` MUST record no event and give one warning in the SDK's existing style that names the problem and never prints the value.
- **FR-004**: An item with both an `id` and an `externalRef`, or with neither, MUST record no event and give one warning. `null` counts as not given. A present `id` that is not a UUID counts as given, so with an `externalRef` it is "both" and is refused.
- **FR-005**: The SDK MUST never send both `item_id` and `external_ref` in one event, nor neither.
- **FR-006**: `placementId`, `actorRef` and `sessionId` MUST keep their rules and work the same for reference events; the SDK MUST NOT invent a placement or any other field, and MUST send no `event_id`.
- **FR-007**: Item events MUST behave exactly as before; existing tests pass unedited except where a task names the exact lines.
- **FR-008**: `fetchPage`, batching, retries, the beacon transport, the loader's settings and the bundle's size and shape MUST be unchanged; no new setting, no new dependency, and no new public export unless the plan shows one is needed.
- **FR-009**: The published types MUST make the item parameter a union of "has an id" and "has an externalRef", so a call with neither fails to compile.
- **FR-010**: The README, the events contract in this repository and the CLAUDE.md status MUST describe the feature, including that the platform must supply a stable, public-identifiers-only reference and fix its format early.
- **FR-011**: The package version becomes `0.8.0`; the owner tags the release after the merge, and content-api takes it in a pin-bump spec of its own.
- **FR-012**: The contract tests MUST run the SDK's events against the shape in content-api's events delta (a reference event with and without the other fields, and an item event unchanged).

### Key Entities

- **External reference**: opaque text the platform chose for something it does not store in content-api. The SDK passes it through and never interprets it.
- **Event (as sent)**: the existing event record with exactly one of `item_id` and `external_ref`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test of 50 events across item and reference calls, each sent event has exactly one of `item_id` and `external_ref`, matching its own call.
- **SC-002**: Every events test of v0.7.0 passes unedited, and an item event is byte for byte what v0.7.0 sent.
- **SC-003**: Every invalid or ambiguous input tested (empty, 129 characters, space, accented letter, NUL, number, object, throwing getter, both, neither, bad id with a reference) records no event, prints one warning and throws nothing.
- **SC-004**: No warning, log line or error produced in any test contains a reference value the platform gave.
- **SC-005**: A call with neither an `id` nor an `externalRef` fails to compile in a type test.
- **SC-006**: The built browser script grows by no more than 1 KB (minified) over v0.7.0.

## Assumptions

- Listings sends references such as `telegram:addis_news/10234` under a placement `telegram` that the owner creates for `listings` on the hosted service; the SDK only sends what the platform passes.
- The service has no opt-in flag and no allowed-prefix rule for references (owner decision, 2026-11-20); the SDK adds none.
- The service validates the reference again; the SDK checks first so a bad value never refuses a batch.
- Out of scope: any change to content-api, reading events back, counting or ranking by reference, deduplication keys (no `event_id`), a session id of the SDK's own, and how Listings builds its Telegram page.
- Nothing is pushed, merged, tagged or published without the owner's go-ahead; the live script on the test service carries the change only after the tag and content-api's pin bump.
