# Feature Specification: Item View Count

**Feature Branch**: `007-item-view-count`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Return the item's view count. content-api's public delivery returns `view_count` on every item since its spec 019 (deployed): a whole number of 0 or more, never missing and never null. The SDK ignored it because its item type has nine fields and drops fields it does not know (feature 006, research R10), so a platform cannot show '1,204 views' beside a post, which matters most beside `sort=popular`. Owner decision (2026-11-18, option A): the SDK returns it as `view_count` on each item, spelled as the service spells it, and it is required: an item whose `view_count` is missing, not a number, not a whole number, negative or not a safe integer fails the whole page as `contract_mismatch`. No default, no optional field. The SDK does not compute, adjust, format, sum or display the count. Version 0.7.0."

**Builds on**: [001-delivery-client](../001-delivery-client/spec.md) (the validator and the item), [002-browser-loader](../002-browser-loader/spec.md) and [006-fetchpage-sort](../006-fetchpage-sort/spec.md) (merged; its research R10 found the gap). **Contract read from** (read only): content-api `specs/019-item-view-counts/contracts/delivery-v1-delta.md`, which amends `specs/009-public-delivery-endpoint/contracts/delivery-v1.md`.

The "user" is a **platform developer** who builds a page that shows content-api items with the platform's own components. Visitors see a number beside a post ("1,204 views") that the platform renders from the data it receives.

**Why**: the service now counts the views of every item and sends the number with each one, but the SDK builds each item field by field and so drops what it does not list. A platform that uses the SDK therefore cannot show how much attention a post got, even when it asks for `popular` posts and wants to show why they are popular. The number is the service's; the SDK only has to pass it on, checked, like every other field.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A platform shows how many times a post was viewed (Priority: P1)

A platform developer calls `fetchPage` and each item in the result carries `view_count`, the whole number the service sent. The platform shows it however it likes.

**Why this priority**: it is the whole feature.

**Independent Test**: with a fake service answering a page whose items carry `view_count` of `1204`, `0` and `7`, `fetchPage` returns items whose `view_count` is `1204`, `0` and `7`, with every other field as before.

**Acceptance Scenarios**:

1. **Given** a page whose items carry `view_count`, **When** `fetchPage` returns, **Then** each item has `view_count` with the number the service sent, and the items keep the order the service gave.
2. **Given** an item the service has never counted a view for, **When** it is returned, **Then** its `view_count` is `0` (a number, not missing).
3. **Given** a count above a thousand, **When** it is returned, **Then** it is the same whole number, not formatted, rounded or summed (`1204`, not `"1,204"` or `1.2k`).
4. **Given** the same call with `sort`, `q`, `tags`, `languages`, `limit` and `cursor`, **When** the page comes back, **Then** the items carry `view_count` in every combination, and the request is unchanged.
5. **Given** the call through the script tag (queued before load or direct), **When** the callback or the promise receives the page, **Then** its items carry `view_count` as in the module.

---

### User Story 2 - A page whose count is missing or wrong is refused, not guessed (Priority: P1)

If the service sends an item without `view_count`, or with a value that cannot be a count, the whole page is a typed `contract_mismatch` error, never a page with a made-up number and never a partial page.

**Why this priority**: the count is only worth showing if it is right, and a wrong shape means the service and the SDK disagree; saying so loudly is the SDK's rule for every field (constitution II).

**Independent Test**: for each bad value (missing, `null`, text, `"5"`, `-1`, `1.5`, `NaN`, `Infinity`, `2**53`, `true`, a list, an object), a fake service's page with one bad item resolves to `{ ok: false, error }` with kind `contract_mismatch`, and no items are returned.

**Acceptance Scenarios**:

1. **Given** an item with no `view_count`, **When** the page is read, **Then** the result is `contract_mismatch`, not an item with `0`.
2. **Given** an item whose `view_count` is `null`, text (including `"5"`), a boolean, a list or an object, **When** read, **Then** the same.
3. **Given** a number that is negative, has a fraction, is `NaN` or infinite, or is above the largest safe integer, **When** read, **Then** the same.
4. **Given** a page of several items where only the last has a bad `view_count`, **When** read, **Then** the whole page is refused, with none of its items returned.
5. **Given** a refused page, **When** the error is returned, **Then** its message says the item's `view_count` is not a whole number of 0 or more, and it contains nothing from the service's text beyond what existing errors carry.

---

### User Story 3 - Everything else stays as it was (Priority: P1)

A platform that does not use the count loses nothing: the request, the other item fields, the error kinds, the loader and the events are unchanged.

**Why this priority**: existing platforms must not be broken by an additive change.

**Independent Test**: every existing test passes once its example items carry `view_count`; no request address changes.

**Acceptance Scenarios**:

1. **Given** any call that worked before, **When** it is made now, **Then** it sends the same request address as 0.6.0.
2. **Given** an item, **When** it is returned, **Then** it has its previous nine fields unchanged plus `view_count`, and nothing else the service might add.
3. **Given** the events calls (`watchView`, `trackLinkClick`), **When** they run, **Then** they are unchanged: they read no count and send none.

### Edge Cases

- A service older than content-api spec 019 sends no `view_count`: every page from it is refused as `contract_mismatch`. This is the owner's choice (research R1): the count is part of the contract, the only service the SDK talks to has had it since spec 019, and a refusal cannot be mistaken for "no views".
- A count of `0` is valid and common; it must never be treated as "missing" (a check that tests truthiness would refuse it).
- `-0` is the number zero and is accepted as `0`.
- Counts are whole numbers up to the largest safe integer (9007199254740991); a service value above it is refused rather than rounded.
- The count is **raw**: a visitor who refreshes ten times can add ten, and it includes views reported by other platforms. It is not a count of people and not for billing, and the service may tighten the rule later; the number may then be lower than before. The SDK says so in the README and does not change the number.
- The count is the service's and follows events as they are stored; the SDK does not cache it, add the views it reports itself, or keep it between calls.
- A platform that builds `Item` values by hand (for example in its own tests) must now give them a `view_count`, because the exported type requires it. This is the type-level cost of the owner's choice and is stated in the README.
- The result for events and for errors is unchanged; only items gain a field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every item in a returned page MUST carry `view_count`, a whole number of 0 or more, exactly as the service sent it (not formatted, rounded, clamped, defaulted or summed). The field is spelled as the service spells it.
- **FR-002**: An item whose `view_count` is missing, `null`, not a number (text, boolean, list, object, symbol), `NaN`, infinite, negative, not a whole number, or above the largest safe integer MUST make the whole page a `contract_mismatch` error, with no items returned. A count of `0` and of `-0` is valid.
- **FR-003**: The SDK MUST NOT default a missing count to `0` and MUST NOT make the field optional.
- **FR-004**: The error for a bad count MUST be the existing `contract_mismatch` kind, with a message that names the field and the rule, and MUST add no new error kind and no new field to errors.
- **FR-005**: The request MUST be unchanged: the same address for every call that worked in 0.6.0, and no new option.
- **FR-006**: The other item fields (`id`, `platform`, `title`, `description`, `language`, `tags`, `images`, `created_at`, `url`) and the page (`items`, `nextCursor`) MUST be exactly as before; the result is built field by field, so nothing else the service sends reaches it.
- **FR-007**: The script-tag loader MUST need no change in behavior: its callbacks and promises receive the same page as the module, with `view_count` on each item, and errors as before.
- **FR-008**: The events calls MUST be unchanged.
- **FR-009**: Nothing in this feature may throw or reject into a platform's page (constitution II and the SDK's no-throw rule), whatever the service sends for `view_count`.
- **FR-010**: The README MUST show the field in the item, say that it is a raw count (not a count of people, not for billing, may become stricter), that it includes views reported by other platforms, that it is the service's number and the SDK only passes it on, and that a page without it is refused as `contract_mismatch`; it MUST say that code which builds `Item` values by hand needs the new field.
- **FR-011**: The package version MUST rise by one minor step (0.7.0); publishing the tag is the owner's act.
- **FR-012**: The existing contract example (the item in the delivery contract test fixtures) MUST gain `view_count` as the service's example does, and a contract test MUST read the rules of content-api's `delivery-v1-delta` for it.
- **FR-013**: No other field, no click count, no score, no formatting helper and no display is added.

### Key Entities

- **Item** (existing): gains `view_count`, a whole number of 0 or more.
- No new entity, error kind or option.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of at least five example counts (`0`, `1`, `7`, `1204`, the largest safe integer) the returned item carries exactly that number.
- **SC-002**: Every bad `view_count` in the scenarios (at least twelve values: missing, `null`, text, a numeric text, a boolean, a list, an object, a negative number, a fraction, `NaN`, infinity, a number above the largest safe integer) gives `contract_mismatch` for the whole page and returns no item, and none throws.
- **SC-003**: Every request address built by the existing tests is byte-identical to before.
- **SC-004**: The same page reaches a platform through the module and through the script tag, queued and direct, with the count on every item.
- **SC-005**: A platform developer can show "N views" beside a post, and knows what the number does and does not mean, from the README alone.

## Assumptions

- The contract is content-api's `delivery-v1-delta` of spec 019: `view_count` is on every item, a whole number of 0 or more, never missing and never `null`, `0` when none, the same for every placement.
- The SDK's rule for item fields (build field by field, refuse the page on any wrong shape) applies unchanged to the new field (constitution II); `url` is the precedent.
- The hosted service and every service the SDK talks to are at least at content-api spec 019, so requiring the field does not refuse real pages.
- Publishing the tag, and the content-api change that takes it (its spec 021, taking `v0.7.0` directly so the served script offers both `sort` and `view_count`), are separate steps by the owner.
- Showing the number (its wording, thousands separators, "views" in the platform's language) is the platform's.
