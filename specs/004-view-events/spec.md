# Feature Specification: Report Views and Link Clicks

**Feature Branch**: `004-view-events`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "The SDK reports what visitors do with the content a platform shows, to content-api's events endpoint (content-api spec 014, merged and deployed 2026-11-17). A platform hands the SDK the element it rendered for an item and the SDK reports a `view` when the item has been seen on screen (at least 50% visible for one continuous second); the platform reports a followed link as `link_click`. Owner decisions (2026-11-17): an explicit call, not page-wide auto-discovery; the platform supplies the optional actor reference, the SDK makes none; events are batched and flushed, sent as a beacon."

**Builds on**: [001-delivery-client](../001-delivery-client/spec.md), [002-browser-loader](../002-browser-loader/spec.md) and [003-search-query](../003-search-query/spec.md) (all merged). **Contract read from** (read only): content-api `specs/014-save-events/contracts/events-v1.md` and `docs/origin/034-content-service-split/research.md` D9. content-api's side needs no change: it stores any `kind`, accepts a `text/plain` body from a browser, and already gives `view` (seen on screen) and `link_click` the meaning ranking will use.

**Why**: the service can rank and count only what it is told. It cannot see the visitor's screen, and the SDK never holds the platform's rendered element on its own, so the platform hands it over. One shared rule for "seen" in the SDK keeps every platform's views comparable, instead of each platform inventing its own.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform reports the items its visitors have seen (Priority: P1)

After a platform renders an item (a card, a row), it calls `watchView(element, item)`. When at least half of the element is visible in the viewport for one continuous second, the SDK reports one `view` event for that item. If the element never gets that visible, nothing is reported.

**Why this priority**: it is the reason the feature exists; views are what ranking will use first.

**Independent Test**: with a fake observer and a fake clock, an element that is 60% visible for 1000 ms produces one `view` event; one that is 40% visible, or visible for 900 ms, or visible for 600 ms and then hidden, produces none.

**Acceptance Scenarios**:

1. **Given** a watched element, **When** at least 50% of it is visible for one continuous second, **Then** one `view` event is reported for its item, and only one however long it stays visible.
2. **Given** a watched element that is visible for 600 ms, hidden, and visible again for 1000 ms, **When** the second stretch completes, **Then** one `view` is reported (the first stretch does not count towards the second).
3. **Given** a watched element that is never half visible, **When** two minutes pass, **Then** nothing is reported and the SDK stops watching and releases it.
4. **Given** `watchView` returned a `stop` function, **When** the platform calls it before the view is reported, **Then** nothing is reported for that watch; calling it again, or after the report, does nothing.
5. **Given** a browser with no way to observe visibility, **When** `watchView` is called, **Then** it reports nothing, returns a `stop` that does nothing, and does not throw.

---

### User Story 2 - A platform reports a followed link (Priority: P1)

When a visitor follows an item's link out (the item's own `url`), the platform calls `trackLinkClick(item)` from its own click handler. The SDK reports one `link_click` event for that item. The SDK adds no click listener and no listener on the platform's elements; the only listener it ever adds is the shared page-hidden signal of User Story 3, made once when the first event is queued.

**Why this priority**: clicks are the other signal ranking will use, and only the platform knows when its link was followed.

**Independent Test**: `trackLinkClick` with an item produces one `link_click` event with the item's id, and each further call produces another.

**Acceptance Scenarios**:

1. **Given** an item, **When** `trackLinkClick(item)` is called, **Then** one `link_click` event for that item is reported.
2. **Given** the same call made twice, **When** both are made, **Then** two events are reported: the SDK does not deduplicate clicks.

---

### User Story 3 - Reporting never gets in the page's way (Priority: P1)

Events are collected and sent together. The SDK sends what it has after a short wait, at once when 50 are waiting, and when the page is hidden or being left, so a view seen just before leaving is still reported. A send never delays the page, never throws into it, and is not retried.

**Why this priority**: the SDK runs in every platform's visitors' browsers; a slow, chatty or crashing reporter is worse than none.

**Independent Test**: with a fake clock and fake transport, 3 events wait about two seconds and then leave in one request; the 50th event leaves at once; a page-hidden signal flushes the rest; a failing transport leaves the page unaffected.

**Acceptance Scenarios**:

1. **Given** events waiting, **When** about two seconds pass since the first of them, **Then** all of them leave in one request.
2. **Given** 50 events waiting, **When** the 50th arrives, **Then** they leave at once in one request, and no request ever holds more than 50.
3. **Given** events waiting, **When** the page becomes hidden or is being left, **Then** they leave at once.
4. **Given** a request that fails (network error, any non-success answer), **When** it fails, **Then** nothing is retried, nothing is thrown into the page, and later events still go out.
5. **Given** no events, **When** the page is hidden or two seconds pass, **Then** no request is made.

---

### User Story 4 - The platform says where and, optionally, who (Priority: P2)

A platform may add the placement the item was read through and an actor reference (a device, a session, a person it already knows) to a call: `watchView(element, item, { placementId, actorRef })` and the same for `trackLinkClick`. The SDK sends them as given and makes up neither; it keeps nothing in a cookie or in storage.

**Why this priority**: the placement lets the service check the event against that placement's filter, and the actor reference lets it deduplicate later. Neither is needed for the first views to be useful.

**Independent Test**: events carry `placement_id` and `actor_ref` exactly when they were given, and none when they were not.

**Acceptance Scenarios**:

1. **Given** `placementId` and `actorRef` in a call, **When** its event is sent, **Then** the event carries them as `placement_id` and `actor_ref`.
2. **Given** neither, **When** its event is sent, **Then** the event carries neither.
3. **Given** an `actorRef` or `placementId` that the service would refuse (empty, too long, wrong type), **When** the call is made, **Then** the SDK leaves it out of that event and reports the event without it, with one console warning; it never sends a batch it knows the service will refuse.

---

### User Story 5 - A bad call or a failing page never breaks the host page (Priority: P2)

Whatever the platform passes, and whatever the browser does, the SDK never throws into the page. A bad argument is one console warning and no event; the page-facing methods accept the queue form before the script has loaded, as `fetchPage` does.

**Why this priority**: constitution V and the loader's own rule: the SDK must be safe to add to a page.

**Independent Test**: calls with no element, no item, an item with no id, a non-object, and a throwing observer or transport each log at most one warning and throw nothing.

**Acceptance Scenarios**:

1. **Given** a missing or unusable element, an item whose `id` is not a UUID, or a non-object option, **When** `watchView` or `trackLinkClick` is called, **Then** one console warning is logged, no event is reported, and nothing is thrown.
2. **Given** the script has not loaded yet, **When** the page pushes `["watchView", element, item, options]` or `["trackLinkClick", item, options]` on the queue, **Then** each runs in order once the script loads; a queued `watchView` cannot hand back a `stop` function.
3. **Given** the tag's settings are missing, **When** any of these is called, **Then** nothing happens, as for `fetchPage`.

### Edge Cases

- The element is removed from the page before it was seen: its watch gives up at the two-minute limit, or earlier when the platform calls `stop`; nothing is reported.
- The platform calls `watchView` for the same item and element twice: each call is its own watch and may report its own `view` (the platform decides; the SDK does not deduplicate views either).
- A very long session: nothing grows without bound: a watch is released when it reports, is stopped, or gives up.
- The page hides and shows repeatedly: only events that are waiting are sent; no empty request.
- An event arrives while a request is leaving: it joins the next batch.
- A visitor's browser has `navigator.sendBeacon` but it refuses the send (too large, queue full): the SDK sends the same batch with a keep-alive `fetch` instead, once.
- The service answers `403 origin_not_allowed`, `404 unknown_placement` or `422 invalid` (a bad placement id, say): the batch is dropped, not retried, and the page sees nothing (a beacon's answer is never readable).
- The visitor leaves the page while the one second has not passed: nothing is reported for that element.
- `item.id` is not a UUID (not text, empty, or any other shape): the call is refused with one warning and the event is not queued; the SDK does not try to repair it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SDK MUST offer `watchView(element, item, options?)` that reports one `view` for the item when at least 50% of the element's area has been visible in the viewport for one continuous second, and returns a `stop` function.
- **FR-002**: A watch MUST report at most once, MUST stop itself when it reports, and MUST give up and release its element two minutes after the watch began if it has not reported, even in the middle of a dwell that has not finished. `stop` MUST cancel an open watch, and calling it again or after the report MUST do nothing.
- **FR-003**: When the browser cannot observe visibility, `watchView` MUST report nothing, return a `stop` that does nothing, and not throw.
- **FR-004**: The SDK MUST offer `trackLinkClick(item, options?)` that reports one `link_click` for the item each time it is called. It MUST add no click listener and none on the platform's elements; the only listener the SDK adds is the shared page-hidden signal (FR-006), made once when the first event is queued.
- **FR-005**: The SDK MUST report events to content-api's events endpoint for the tag's platform as a batch of at most 50, in the shape of the service's `events-v1` contract (`platform_id`, and per event `item_id`, `kind`, and when given `placement_id`, `actor_ref`, `occurred_at`). `occurred_at` MUST be the time the event happened, as an ISO 8601 time with a zone.
- **FR-006**: The SDK MUST send waiting events about two seconds after the first of them was queued, at once when 50 are waiting, and at once when the page is hidden or being left. It MUST make no request when none are waiting, and MUST never send more than 50 in one request.
- **FR-007**: A batch MUST be sent as a beacon with a `text/plain` body (which needs no pre-flight), and, when the beacon is unavailable or refuses it, once as a keep-alive `fetch` with the same body and content type. A failed send MUST NOT be retried and MUST NOT affect later sends.
- **FR-008**: `options.placementId` and `options.actorRef`, when given and valid (placement id: 3 to 40 characters of `a-z`, `0-9`, `-`; actor reference: 1 to 128 characters of text with no NUL), MUST be sent as `placement_id` and `actor_ref`. A value that is given but not valid MUST be left out of that event with one console warning. The SDK MUST NOT invent either, and MUST NOT write any cookie or storage.
- **FR-009**: The two methods MUST be on `window.contentSdk` after the loader runs, MUST be accepted on the page's queue before it, and MUST take the platform id and base address from the script tag, as `fetchPage` does. The library MUST export the same two functions taking a target first (`watchView(target, element, item, options?)`), as `fetchPage` takes one.
- **FR-010**: Every method MUST never throw or reject into the page. A bad argument (no usable element, an item whose `id` is not a UUID, an option that is not an object) MUST be one console warning and no event.
- **FR-011**: The SDK MUST NOT render, create or change any element, style or attribute on the page, MUST add no runtime dependency, and MUST send no item content other than the item's id.
- **FR-012**: An item's `id` MUST be sent exactly as the service gave it, and only when it has the shape of the ids the service gives (a UUID): the service refuses a whole batch for one malformed id, so one wrong id would lose the good events beside it. An item with any other `id` MUST be one console warning and no event.
- **FR-013**: The version MUST become 0.4.0 (an additive public API); `fetchPage` and every existing behavior MUST be unchanged.

### Key Entities

- **Event**: `view` or `link_click` for one item, with the time it happened and, when the platform gave them, the placement and an actor reference.
- **Watch**: one element being observed for one item, ending when it reports, is stopped, or gives up.
- **Batch**: the events waiting to be sent together, at most 50, sent as one request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the visibility cases (below, at, and above 50%; shorter and longer than one second; hidden in between), a view is reported if and only if the half-visible second was continuous, in 100% of the test cases.
- **SC-002**: No more than one request per flush, never more than 50 events in it, and no request when nothing is waiting, in 100% of the test cases.
- **SC-003**: Every unusable argument and every failing observer, transport or callback ends in no exception and at most one console warning, in 100% of the test cases.
- **SC-004**: Every payload the SDK builds is accepted by the service's `events-v1` contract rules (checked by contract tests against the shapes in content-api's contract files, constitution IV).
- **SC-005**: The built browser file grows by no more than 5 KiB (5,120 bytes) minified (before and after are recorded in `research.md`) and has no runtime dependency; the existing tests pass unchanged.
- **SC-006**: A visitor's page makes no new request until an event has been reported, and the SDK sets no cookie and touches no storage.

## Assumptions

- **Owner decisions** (2026-11-17, recorded in `research.md` by the plan): an explicit `watchView(element, item)` call, not page-wide auto-discovery (the SDK stays headless and touches nothing it was not handed); the platform supplies the optional actor reference (the SDK has no storage and makes no id); events are batched and flushed, sent as a beacon with a fetch fallback.
- A `view` means seen on screen, as content-api's contract and research D9 define it; the threshold (50% for one continuous second, the IAB rule `ad-serve-client` uses) lives only here.
- The actor reference is a per-call option; a tag attribute for it is not added (no requirement needs it yet, constitution VI). A generic `reportEvent` for other kinds is not added either: the service stores any kind, but the first platform needs only these two.
- Events are best effort and never retried: a lost beacon is a lost event, as the service's browser path is documented (not for billing).
- A beacon's answer is never readable, so the SDK cannot tell a refused batch from an accepted one; it only checks that the browser took the beacon.
- `placementId` is how the platform says which placement it read the item through (the same id it passed to `fetchPage`); the SDK does not remember it from a fetch.
- Version 0.4.0 is tagged and taken by content-api (a pin change like its spec 013) only after the owner says so; nothing is published or tagged by this feature.
- The service's pre-flight and `text/plain` handling are already deployed (content-api spec 014); no change is needed there.
