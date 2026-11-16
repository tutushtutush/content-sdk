# Feature Specification: Browser Bundle and Loader

**Feature Branch**: `002-browser-loader`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Browser bundle and loader: make the delivery client usable from a plain script tag, the way ad-serve-client is. The script reads the service address and platform id once from its own tag, replays commands queued before it loaded, then exposes the same commands as methods. First command: fetchPage(placementId, query, callback). Never throws into the host page. A minified browser bundle with a source map, built by the build and by a prepare step so an install from the repository gives a built package. Tag v0.2.0 after merge (the owner's call). README gets an Embedding section. Out of scope: rendering, infinite-scroll UI, events, ranking, search, caching, serving the file from content-api, npm publish."

**Builds on**: [001-delivery-client](../001-delivery-client/spec.md) (merged). Precedent read only: `ad-serve-client` (`loader/snippet.js`, `scripts/build.mjs`, README "Embedding").

## User Scenarios & Testing *(mandatory)*

The "user" is a **platform developer** who puts two script tags on a page and calls the SDK without a bundler. A second user is **content-api's maintainer**, who reads the built browser file once at startup and serves it at `GET /content-sdk.js` (that serving is a separate spec in content-api). Visitors see only what the platform renders from the data.

### User Story 1 - Embed with a script tag and fetch a page (Priority: P1)

A platform developer pastes a one-line stub and one `async` script tag (service address and platform id as attributes) into a page. Then they call `fetchPage(placementId, query, callback)` and the callback receives the same result the delivery client gives: plain data on success, a typed error on failure.

**Why this priority**: This is the feature. With only this, a platform with no build step can show content.

**Independent Test**: Load the built browser file in a jsdom page that has the stub and the attributes, with a fake network function; call `window.contentSdk.fetchPage("latest", { limit: 5 }, cb)` and confirm `cb` gets the page from the fake.

**Acceptance Scenarios**:

1. **Given** a page with the stub and the script tag with both attributes, **When** the script has loaded and the page calls `fetchPage("latest", { limit: 5 }, cb)`, **Then** the request goes to the base address from the tag, for the platform id from the tag and the placement id given, and `cb` receives the delivery client's result.
2. **Given** the same page, **When** the call fails (unknown placement, network failure, a bad answer), **Then** `cb` receives the typed error and nothing is thrown into the page.
3. **Given** the same call made after load, **When** the page also keeps the return value, **Then** it is a promise of the same result the callback received.
4. **Given** the query options of the delivery client (limit, tags, languages, cursor), **When** they are passed in the query, **Then** they behave exactly as in the delivery client, including its refusals before sending.
5. **Given** a call with no callback, **When** it is made after load, **Then** the promise still resolves with the result and nothing fails.

---

### User Story 2 - Call before the script has loaded (Priority: P1)

Because the script tag is `async`, page code may run before it loads. The page pushes commands onto the stub's queue (`window.contentSdk.q.push(["fetchPage", "latest", {}, cb])`), and when the script loads it runs them in the order pushed. After that, the same commands are ordinary methods.

**Why this priority**: With an async tag this is the normal case, not an edge case; without replay, early calls are lost.

**Independent Test**: Push three commands onto the stub queue, load the file, and confirm the callbacks fire in the order pushed with the right results; then call the method directly and confirm it works too.

**Acceptance Scenarios**:

1. **Given** commands queued before load, **When** the script loads, **Then** each runs once, in the order queued, with the platform id and base address from the tag.
2. **Given** a queued command whose callback throws, **When** the queue is replayed, **Then** the other queued commands still run and still receive their results.
3. **Given** a queued command with an unknown name or bad arguments, **When** the queue is replayed, **Then** one console warning names it, the rest still run, and nothing is thrown into the page.
4. **Given** the script has loaded, **When** the page pushes onto `q` afterwards, **Then** the command still runs (the queue keeps working after load, as in the precedent) [see Assumptions].

---

### User Story 3 - Misconfiguration is visible and harmless (Priority: P2)

If the service address or platform id attribute is missing or blank, the script logs one console warning that names the attribute and does nothing else. The host page keeps working.

**Why this priority**: A copy-paste mistake must be easy to find and must never break the platform's page, but the feature works without it.

**Independent Test**: Load the file with each attribute missing, empty, and whitespace only; confirm exactly one warning per load naming the attribute, no methods installed, no queued command run, and no error thrown.

**Acceptance Scenarios**:

1. **Given** a script tag without `data-api-base-url`, **When** it loads, **Then** one warning names `data-api-base-url` and nothing else happens.
2. **Given** a script tag without `data-platform-id` (or with a blank one), **When** it loads, **Then** one warning names `data-platform-id` and nothing else happens.
3. **Given** both attributes are missing, **When** it loads, **Then** one warning is logged that names both, not two.
4. **Given** a base address that is present but not a usable `http` or `https` address, **When** a command is called, **Then** the callback receives the delivery client's `invalid_target` error, and nothing is thrown.

---

### User Story 4 - Install from the repository and serve the file (Priority: P2)

The maintainer installs the package from the repository at a tag, gets a built package without running the build by hand, and finds the browser file by a stable, documented path (so content-api can read it once and serve it). Existing imports of the SDK keep working.

**Why this priority**: It is how the file reaches platforms. It comes after the file itself works.

**Independent Test**: Pack the repository as an install would (run its prepare step in a clean copy), then confirm the browser file exists, the documented path resolves from Node, and `import` and `require` of the package still give `fetchPage`.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the package is installed from the repository (the install runs the prepare step), **Then** the built files, including the minified browser file and its source map, are present without a manual build.
2. **Given** an installed package, **When** a Node program resolves the documented path, **Then** it gets the browser file and can read it.
3. **Given** an installed package, **When** a program imports or requires the package by name, **Then** it still gets `fetchPage` and the types, unchanged from 001.
4. **Given** the build, **When** it finishes, **Then** the browser file is minified, has a source map, and exposes no global other than `contentSdk` [see Assumptions].

---

### Edge Cases

- **Script loaded twice** on one page: the second load does not replay the queue again or replace the first one's methods; it logs one warning.
- **Stub missing** (no `window.contentSdk` before the script loads): the script creates it and still works, so a page without the stub line does not break.
- **`async` or `defer`, or neither**: the script finds its own tag by the page's record of the script now running, not by searching the page for a source address, so a renamed or proxied file still works. If the tag cannot be found (for example the file is evaluated by a loader that hides it), it is the same as missing attributes.
- **Attributes changed after load**: ignored; they are read once.
- **Queued entry not an array, or empty**: warned once, skipped.
- **A callback that is not a function**: ignored; the promise still gives the result.
- **A callback that throws or rejects**: caught and logged once by name; it does not affect the promise returned to the caller, other callbacks, or the page.
- **The returned promise never rejects**; an error is a resolved failure result, as in 001.
- **The page replaces `window.contentSdk` after load**: the SDK does nothing about it.
- **No `fetch` in the browser**: the delivery client returns its `network` error; the loader adds nothing.
- **A very large queue**: replayed in order, one command at a time, without blocking the page for longer than the calls themselves need.
- **Content Security Policy** that forbids the script's source: the browser blocks it; nothing to handle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The browser file MUST be a single script that works when loaded with a plain `<script>` tag (with or without `async`), needs no bundler, and creates no global except the one named `contentSdk`.
- **FR-002**: On load, the script MUST read the service address from the `data-api-base-url` attribute and the platform id from the `data-platform-id` attribute of its own script tag, once, and MUST NOT read or watch them again.
- **FR-003**: If either attribute is missing, empty or only whitespace, the script MUST log one console warning that names every attribute that is bad and MUST do nothing else: install no methods, run no queued command, change nothing on the page.
- **FR-004**: The script MUST use the existing `window.contentSdk` stub and its queue if present, and MUST create the object if it is absent.
- **FR-005**: Commands pushed onto the queue as `[name, ...args]` before load MUST run once each, in the order pushed, after the script has read its attributes.
- **FR-006**: After load, each command MUST also be a method on `window.contentSdk` taking the same arguments, and pushing onto the queue after load MUST still run the command.
- **FR-007**: The first command, `fetchPage(placementId, query, callback)`, MUST call the delivery client's `fetchPage` with the base address and platform id from the tag, the given placement id, and the given query (limit, tags, languages, cursor, exactly as in 001), and MUST pass the delivery client's result unchanged to the callback.
- **FR-008**: Called as a method after load, `fetchPage` MUST also return a promise of the same result; the promise MUST never reject.
- **FR-009**: A callback that is missing, not a function, or that throws (or returns a rejected promise) MUST NOT affect the returned promise, other queued commands, or the page; a throwing callback MUST be reported with one console warning.
- **FR-010**: The script MUST NOT throw or reject into the host page for any input: a bad placement id, a bad query, an unknown command name, malformed queue entries, or a failing network all produce a typed result or one warning.
- **FR-011**: An unknown command name or malformed queue entry MUST produce one console warning that names it and MUST NOT stop the other commands.
- **FR-012**: The script MUST NOT render, create or change page elements, inject styles, or read the page beyond finding its own script tag and its two attributes. The delivery client from 001 stays free of the page and window; only the loader module touches them.
- **FR-013**: The script MUST NOT send, store or read anything beyond what the delivery client sends (no cookies, no storage, no identifiers, no extra requests).
- **FR-014**: The build MUST produce the browser file as a minified script with a source map, and it MUST contain no runtime dependency.
- **FR-015**: The package MUST build its files when installed from the repository at a tag, without a manual build step.
- **FR-016**: The package MUST keep the existing import and require entry points and types working as in 001 and MUST give a documented path from which a Node program can resolve the browser file by name.
- **FR-017**: A second load of the script on the same page MUST NOT replay the queue again or replace the first load's methods, and MUST log one warning.
- **FR-018**: The README MUST have an "Embedding" section with the stub, the script tag, what each attribute is, the missing-attribute warning text, and the `fetchPage` call before and after load.
- **FR-019**: The loader's public surface (the global name, the attributes, the commands, the warning texts and the documented file path) MUST be documented in a contract file and treated as versioned: a change that breaks a platform page needs a major version.
- **FR-020**: Unit tests with fakes MUST cover queue replay and order, attribute reading, the missing-attribute warning, callback isolation, unknown commands, and double load; a jsdom test MUST load the built file in a page with the stub and get data back from a fake network function.

### Key Entities

- **Stub**: The small object a page creates before the script loads: an empty command queue. After load the same object also carries the commands as methods.
- **Command**: A queued entry: a name and its arguments. The first command is `fetchPage`.
- **Loader settings**: The service address and platform id read once from the script's own tag; fixed for the life of the page.
- **Result**: The delivery client's result from 001: plain data on success, a typed error on failure. Passed through unchanged.
- **Browser file**: The one minified script (with its source map) that platforms load and content-api will serve.
- **Documented file path**: The stable name by which Node programs find the browser file in the installed package.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform developer with no build tool can show a first page of items using only the stub, one script tag and one call, copied from the README, in under 10 minutes.
- **SC-002**: In a page test with the stub and the script, 100% of commands queued before load (at least 20 in one test) run exactly once, in order, whatever their callbacks do.
- **SC-003**: In a test that drives the loader with at least 20 bad inputs (missing or blank attributes, unknown commands, malformed queue entries, throwing callbacks, bad arguments, failing network), 0 exceptions reach the host page and each bad configuration logs exactly one warning.
- **SC-004**: The browser file is a single file, minified, with a source map, and the page loads it without any other file or tool.
- **SC-005**: A clean install from the repository gives a built package, and the browser file is found by its documented path in 100% of tries on a clean checkout.
- **SC-006**: Existing users of the 001 import and require entry points need no change: the 001 test suite passes unchanged.
- **SC-007**: A run of the browser file in a page against the hosted test service (platform `listings`, placement `latest`, from its allowed origin `https://listings-test-nine.vercel.app`) returns a valid page; this step is checked by hand by the owner.

## Assumptions

- **Audience**: platform developers who use a plain script tag, and content-api's maintainer who serves the file. Rendering is the platform's.
- **Names** follow the precedent: global `contentSdk`, queue `q`, attributes `data-api-base-url` and `data-platform-id`, stub `window.contentSdk = window.contentSdk || { q: [] }`, as written in the feature description.
- **Queue after load**: the precedent's queue keeps working after load (pushing runs the command). This spec keeps that so the stub need not change after load.
- **The one place that touches the page** is a small loader module that reads its own script tag and installs the global. The delivery client from 001 and its "no page" rule are not changed; the loader's page access is the narrow exception FR-012 allows, and it creates no page elements.
- **Documented path**: a package subpath for the browser file (for example `content-sdk/browser`), so `require.resolve` of that path gives the file, while the bare package name keeps giving the CommonJS entry, because pointing the bare name at a script that exports nothing would break imports. The exact name is chosen in the plan with the owner.
- **Install from the repository** runs the prepare step, so the build tool is available to that step as a development dependency; the package stays `private` and unpublished.
- **No timeout or retry** is added; the delivery client's signal option is not exposed by the loader command in this version.
- **Release**: the tag `v0.2.0` after merge, and any publish, are the owner's call; this feature does not create them.
- **Out of scope**: rendering, infinite-scroll UI, events, ranking, search, caching, slots markup, serving the file from content-api (its own spec), npm publish, and changes to the delivery client's behavior.
- **Dependencies**: the merged 001 delivery client; `ad-serve-client` as read-only precedent; content-api for the later serving spec.
