# Research: Report Views and Link Clicks

Decisions, the alternatives considered, and what was rejected, with the reason. The service side is content-api spec 014 (`specs/014-save-events/contracts/events-v1.md` there, read only).

## R1. An explicit call, not page-wide discovery (owner, 2026-11-17)

- **Decision**: the platform calls `watchView(element, item, options?)` after it renders an item and `trackLinkClick(item, options?)` when a link is followed. Both are on `window.contentSdk`, accepted on the queue, and exported by the library.
- **Why**: the SDK is headless (constitution I). It creates and changes nothing on the page and holds no element it was not handed. The platform already has the element (a framework ref callback) and the click handler.
- **Alternative**: the platform marks cards with `data-content-item` and the SDK finds them with a page-wide observer. Less code for the platform, but the SDK would watch the whole page's DOM and attach click listeners itself, which breaks "touches nothing it was not handed". Rejected by the owner.

## R2. The platform supplies the actor reference (owner, 2026-11-17)

- **Decision**: `actorRef` is an optional per-call option, sent as `actor_ref` when valid. The SDK makes none, keeps no cookie and uses no storage.
- **Why**: the platform owns identity (the service holds none of it either). The SDK's loader contract already promises no cookie and no storage.
- **Alternative**: the SDK makes an anonymous id (in memory, or in `localStorage`). In-memory ids change on every page load, and storing one breaks the promise and needs a privacy decision. Rejected by the owner.
- **Not added**: a tag attribute for it (no requirement needs one, constitution VI).

## R3. Events are batched and flushed (owner, 2026-11-17)

- **Decision**: waiting events leave together about two seconds after the first was queued, at once when 50 are waiting, and when the page is hidden or being left. Never more than 50 per request, no request when none wait.
- **Why**: fewer requests for a busy list, and a view seen just before leaving the page is still sent. 50 is the service's batch limit.
- **Alternative**: one request per event. Simpler, but chatty and more likely to lose the last event on a page leave. Rejected by the owner.
- **Constants** (one place, tested): flush delay 2000 ms, batch 50, dwell 1000 ms, visible ratio 0.5, give-up 120000 ms.

## R4. The SDK checks the shape of the ids and values it sends, which amends spec FR-012

- **What was found**: the service refuses a **whole** batch (`422 invalid`) when one event has a malformed field (content-api spec 014, R1 and R11), and a beacon's answer is never readable. So one wrong `item.id`, `placementId` or `actorRef` would silently lose every good event in the same batch.
- **Decision**: the SDK sends an event only when its item id is a UUID. A `placementId` or `actorRef` that the service would refuse is left out of that event, with one console warning; an item id that is not a UUID drops that event, with one warning. The spec's FR-012 ("do not validate the id's shape") was reworded to say this, and the edge case and acceptance scenario with it.
- **Why**: protect the good events; the rules are the service's own (UUID; `placement_id` 3 to 40 of `a-z`, `0-9`, `-`; `actor_ref` 1 to 128 characters, no NUL), checked in the SDK so the SDK never sends a batch it knows will be refused.
- **Alternative**: send whatever the platform passes and let the service refuse the batch. Rejected: silent, whole-batch loss.

## R5. How a view is decided

- **Decision**: an `IntersectionObserver` on the element with a threshold of 0.5. When it reports the element intersecting with a ratio of at least 0.5, a 1000 ms timer starts; if the element drops below 0.5 (or stops intersecting) before it fires, the timer is cancelled and the dwell starts over. When it fires, one `view` is queued and the watch ends. A watch that has not reported gives up 120000 ms after it began and releases the element and the observer; this is a fixed wall-clock cap from the start of the watch, so it also cuts off a dwell that is still running (the rare cost is a view lost in the last second).
- **Why**: the IAB rule, as `ad-serve-client`'s `viewabilityDetector.ts` does it (50% for one continuous second, a wall-clock cap so a never-seen card does not hold its element for the whole page life).
- **Without an observer** (`IntersectionObserver` missing, or its constructor throws): the watch does nothing and returns a `stop` that does nothing.
- **Once per watch**: each call is its own watch; the SDK does not deduplicate views by item (the platform decides, and the service has no counting rule yet).

## R6. The transport

- **Decision**: `POST {baseUrl}/api/v1/events` with the body `JSON.stringify({ platform_id, events })`, first as `navigator.sendBeacon(url, body)` (a string body is sent as `text/plain;charset=UTF-8`, a CORS-safelisted type, so no pre-flight), and, when the beacon is missing or returns `false`, once as `fetch(url, { method: "POST", body, keepalive: true, credentials: "omit", headers: { "content-type": "text/plain;charset=UTF-8" } })` whose result is ignored. A failed send is never retried.
- **Why**: a beacon survives a page leave; `text/plain` needs no pre-flight (content-api spec 014 R10 accepts it); the fallback covers a refused beacon or an older browser. No retry: events are best effort, as the service's browser path is documented.
- **Alternative**: JSON content type. Needs a pre-flight and a `fetch` only. Rejected.

## R7. Known cost, for the owner: a console message from the beacon's credentials mode

- **What**: `sendBeacon` sends cross-origin requests in credentials mode `include`. A browser then wants `Access-Control-Allow-Credentials: true` on the answer, and content-api's events answer does not send it. The event is still delivered and stored, but some browsers (Chrome) may print a CORS message in the visitor's console for each beacon. The SDK cannot see or hide it.
- **Options**: (a) accept it (the owner's decision was a beacon with a fetch fallback); (b) send with `fetch` and `credentials: "omit"` first and use the beacon only as the fallback, which prints nothing but is a different primary path from the one the owner chose; (c) a content-api change adding `Access-Control-Allow-Credentials: true` to events answers for allowed origins (a small service change, its own decision).
- **Plan**: build (a) as decided, and check in a real browser against the hosted test service in the owner's step (quickstart). The result decides whether (b) or (c) is worth a follow-up. Recorded here so it is not a surprise.

## R8. Where the code lives

- **Decision**: a new `src/events/` folder: `rules.ts` (validate the item id and options, build one event), `batcher.ts` (queue, flush policy, injected clock and timers), `transport.ts` (address, body, beacon, fetch fallback), `watch.ts` (one viewability watch, injected observer and timers), `reporter.ts` (puts them together for one target and page). The loader (`src/loader/`) gets two page-facing methods built from the reporter; `src/index.ts` exports `watchView` and `trackLinkClick` for the library.
- **The library functions** keep one reporter per target (`baseUrl` and `platformId`), created on first use with the real globals. With no `IntersectionObserver` (Node), `watchView` is inert; `trackLinkClick` still queues and sends through `fetch`.
- **Alternative**: put it all in the loader. Rejected: the library needs it too, and the pieces are easier to test apart (constitution V).

## R9. Environment is injected, with structural types only

- **Decision**: the new code takes a small `ReportEnv` (a clock, timers, the observer constructor, `sendBeacon`, `fetch`, a way to hear "page hidden") as structural types, as the loader's `Env` does, so the project still compiles without the DOM library and tests pass plain fakes. The loader's `Env` grows by the same few optional members, read from `globalThis`.
- **Page hidden**: both `pagehide` on the window and `visibilitychange` on the document (with `visibilityState === "hidden"`), because browsers differ on which fires when a tab is closed or backgrounded.

## R10. Queue entries

- **Decision**: `["watchView", element, item, options]` and `["trackLinkClick", item, options]` run in order when the script loads, like `fetchPage`. A queued `watchView` cannot hand back a `stop`; to stop a watch the platform calls the method after the script has loaded.

## R11. Never throw

- **Decision**: every public function, every observer callback and every timer callback is wrapped; a failure is one console warning (clipped text, as the loader does) and no event. A broken `console` is ignored.

## R12. The shared base-address check

- **Decision**: the address of the events endpoint is built from the same checks `buildRequestUrl` makes on `baseUrl` (http or https, no query or fragment). Those checks move into one small helper that both use, with no behavior change; the existing request tests are the proof.

## R13. Contract tests

- **Decision**: `tests/contract/events-v1.test.ts` holds a validator written from the rules of content-api's events contract (batch size, `item_id` UUID, `kind` slug, `placement_id` slug, `actor_ref` length, `occurred_at` ISO with zone, unknown fields allowed) and runs every payload the SDK builds through it (constitution IV).

## R14. Left out, on purpose (constitution VI)

- A tag attribute for the actor reference; a generic `reportEvent` for other kinds; retries or an outbox; remembering the placement from a fetch; deduplicating views or clicks; any rendering or listener on the page. Each can be added when a requirement shows up.

## R15. Approaches started and reversed during the build, and corrections

No design decision was reversed. What changed on the way, with the reason:

- **The page-reading module is `src/events/page-env.ts`, not under `src/loader/`.** The library needs it too, and a library file that imports from `loader/` would put `dist/loader` declarations into the package, which an existing test forbids. The guard in `tests/unit/headless.test.ts` now counts this one file, with the loader, as the code that reads the page.
- **Two existing guards were updated for what this feature is for.** `headless.test.ts` no longer lists `sendBeacon` as forbidden in the loader (the reporter sends batches that way), and its rule that `document` is read only for the running script also allows the page-hidden signal (the visibility state and one listener). `install.test.ts`'s list of the stub's keys gained `watchView` and `trackLinkClick`. Every other existing test passes unedited.
- **The batcher sets its "timer running" flag only after the timer exists.** The first draft set it before; a timer function that throws (a no-throw test) left the flag set and the batch would never have been scheduled. Found by the no-throw tests.
- **The reporter guards `clearTimeout` as well as the console.** A clear that throws made a page-hidden flush throw; the no-throw tests found it.
- **A view's time is the moment the dwell completed.** The event is built once when the call is made (to check the item and options and give the warnings once) and given its time again when the view completes.
- **A watch's "page was hidden mid-dwell" case is tested at the reporter**, not the watch: nothing has been queued at that point, so nothing is sent, and the page's own timers stop with the page.

## R16. Measured

- `dist/content-sdk.js` before: 8,080 bytes. After: 13,146 bytes. Growth: **5,066 bytes (4.95 KiB)**. SC-005 said "at most 5 KB" without saying which kilobyte; it holds at 1,024 bytes and not at 1,000. The owner decided (2026-11-17, converge T027, option 1) to read it as 5 KiB, so the spec now says "5 KiB (5,120 bytes)" and the code stays as it is. The alternative, shortening the console warnings to get under 5,000 bytes, was rejected: the warnings are what tells a platform developer what a bad call did wrong.
