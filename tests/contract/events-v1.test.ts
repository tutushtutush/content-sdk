import { createReporter } from "../../src/events/reporter";
import { fakeEnv } from "../unit/events/helpers";

// The rules of content-api's events contract (specs/014-save-events/contracts/events-v1.md there, and the
// deltas of specs 016, 017 and 022, read only), written as a validator. It is checked against examples first, then every payload the SDK
// builds is run through it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND = /^[a-z0-9_-]{1,32}$/;
const EXTERNAL_REF = /^[A-Za-z0-9_.:/-]{1,128}$/;
const PLACEMENT = /^[a-z0-9-]{3,40}$/;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

function problemsOf(body: unknown): string[] {
  const problems: string[] = [];
  if (typeof body !== "object" || body === null || Array.isArray(body)) return ["body must be an object"];
  const { events } = body as { events?: unknown };
  if (typeof (body as { platform_id?: unknown }).platform_id !== "string") problems.push("platform_id must be text");
  if (!Array.isArray(events) || events.length < 1 || events.length > 50) return [...problems, "events must be a list of 1 to 50"];
  events.forEach((event: unknown, i) => {
    const at = `events[${i}]`;
    if (typeof event !== "object" || event === null || Array.isArray(event)) return void problems.push(`${at} must be an object`);
    const e = event as Record<string, unknown>;
    // Exactly one of item_id and external_ref (spec 022 delta); null counts as not given.
    const hasItem = e.item_id !== undefined && e.item_id !== null;
    const hasRef = e.external_ref !== undefined && e.external_ref !== null;
    if (hasItem === hasRef) problems.push(`${at}.item_id`, `${at}.external_ref`);
    else if (hasItem && (typeof e.item_id !== "string" || !UUID.test(e.item_id))) problems.push(`${at}.item_id`);
    else if (hasRef && (typeof e.external_ref !== "string" || !EXTERNAL_REF.test(e.external_ref))) problems.push(`${at}.external_ref`);
    if (typeof e.kind !== "string" || !KIND.test(e.kind)) problems.push(`${at}.kind`);
    if (e.placement_id !== undefined && (typeof e.placement_id !== "string" || !PLACEMENT.test(e.placement_id))) problems.push(`${at}.placement_id`);
    if (e.actor_ref !== undefined && (typeof e.actor_ref !== "string" || [...e.actor_ref].length < 1 || [...e.actor_ref].length > 128 || e.actor_ref.includes("\u0000"))) problems.push(`${at}.actor_ref`);
    if (e.session_id !== undefined && e.session_id !== null && (typeof e.session_id !== "string" || [...e.session_id].length < 1 || [...e.session_id].length > 128 || e.session_id.includes("\u0000"))) problems.push(`${at}.session_id`);
    if (e.occurred_at !== undefined && (typeof e.occurred_at !== "string" || !ISO_WITH_ZONE.test(e.occurred_at) || Number.isNaN(Date.parse(e.occurred_at)))) problems.push(`${at}.occurred_at`);
  });
  return problems;
}

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
// The example of the contract, as written there.
const contractExample = {
  platform_id: "listings",
  events: [{ item_id: ID, kind: "view", placement_id: "home", actor_ref: "device-abc", session_id: "s-7f3a91c2", occurred_at: "2026-11-17T08:00:00Z" }],
};

describe("the validator itself", () => {
  it("accepts the contract's example and a minimal event, and ignores unknown fields", () => {
    expect(problemsOf(contractExample)).toEqual([]);
    expect(problemsOf({ platform_id: "x", events: [{ item_id: ID, kind: "view" }] })).toEqual([]);
    expect(problemsOf({ platform_id: "x", extra: 1, events: [{ item_id: ID, kind: "view", colour: "red" }] })).toEqual([]);
  });

  it.each([
    ["no events", { platform_id: "x" }],
    ["an empty list", { platform_id: "x", events: [] }],
    ["51 events", { platform_id: "x", events: Array.from({ length: 51 }, () => ({ item_id: ID, kind: "view" })) }],
    ["a bad item_id", { platform_id: "x", events: [{ item_id: "123", kind: "view" }] }],
    ["a bad kind", { platform_id: "x", events: [{ item_id: ID, kind: "View" }] }],
    ["a bad placement_id", { platform_id: "x", events: [{ item_id: ID, kind: "view", placement_id: "ab" }] }],
    ["an empty actor_ref", { platform_id: "x", events: [{ item_id: ID, kind: "view", actor_ref: "" }] }],
    ["an empty session_id", { platform_id: "x", events: [{ item_id: ID, kind: "view", session_id: "" }] }],
    ["a 129-character session_id", { platform_id: "x", events: [{ item_id: ID, kind: "view", session_id: "x".repeat(129) }] }],
    ["a session_id with a NUL", { platform_id: "x", events: [{ item_id: ID, kind: "view", session_id: "a\u0000b" }] }],
    ["a session_id that is a number", { platform_id: "x", events: [{ item_id: ID, kind: "view", session_id: 7 }] }],
    ["both item_id and external_ref", { platform_id: "x", events: [{ item_id: ID, external_ref: "a", kind: "view" }] }],
    ["neither item_id nor external_ref", { platform_id: "x", events: [{ kind: "view" }] }],
    ["an empty external_ref", { platform_id: "x", events: [{ external_ref: "", kind: "view" }] }],
    ["a 129-character external_ref", { platform_id: "x", events: [{ external_ref: "x".repeat(129), kind: "view" }] }],
    ["an external_ref with a space", { platform_id: "x", events: [{ external_ref: "a b", kind: "view" }] }],
    ["an external_ref with an accent", { platform_id: "x", events: [{ external_ref: "é", kind: "view" }] }],
    ["an external_ref that is a number", { platform_id: "x", events: [{ external_ref: 7, kind: "view" }] }],
    ["an occurred_at with no zone", { platform_id: "x", events: [{ item_id: ID, kind: "view", occurred_at: "2026-11-17T08:00:00" }] }],
  ])("refuses %s", (_name, body) => {
    expect(problemsOf(body).length).toBeGreaterThan(0);
  });
});

describe("every payload the SDK builds meets the events contract", () => {
  const target = { baseUrl: "https://api.example.com", platformId: "listings" };
  const bodies = (f: ReturnType<typeof fakeEnv>) => f.beacons.map((b) => JSON.parse(b.body) as unknown);

  it("for a view, a click, both options, neither, and an invalid option left out", () => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    reporter.watchView({}, { id: ID });
    f.observers()[0]?.emit(0.9);
    f.clock.advance(1000);
    reporter.watchView({}, { id: ID }, { placementId: "latest", actorRef: "device-abc" });
    f.observers()[1]?.emit(0.9);
    f.clock.advance(1000);
    reporter.trackLinkClick({ id: ID.toUpperCase() });
    reporter.trackLinkClick({ id: ID }, { placementId: "latest", actorRef: "😀".repeat(128) });
    reporter.trackLinkClick({ id: ID }, { placementId: "Not A Slug", actorRef: "" });
    f.clock.advance(2000);
    const sent = bodies(f);
    expect(sent).toHaveLength(1);
    expect(problemsOf(sent[0])).toEqual([]);
    expect((sent[0] as { events: unknown[] }).events).toHaveLength(5);
  });

  it("with and without a sessionId: the key is present only when a valid one was given, and the body meets the contract", () => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    reporter.trackLinkClick({ id: ID }, { sessionId: "s-7f3a91c2" });
    reporter.trackLinkClick({ id: ID }, { sessionId: "😀".repeat(128), actorRef: "device-abc", placementId: "latest" });
    reporter.trackLinkClick({ id: ID });
    reporter.trackLinkClick({ id: ID }, { sessionId: null });
    reporter.trackLinkClick({ id: ID }, { sessionId: "" });
    reporter.trackLinkClick({ id: ID }, { sessionId: "x".repeat(129) });
    reporter.trackLinkClick({ id: ID }, { sessionId: "a\u0000b" });
    f.clock.advance(2000);
    const sent = bodies(f);
    expect(sent).toHaveLength(1);
    expect(problemsOf(sent[0])).toEqual([]);
    const events = (sent[0] as { events: Record<string, unknown>[] }).events;
    expect(events).toHaveLength(7);
    expect(events.map((e) => "session_id" in e)).toEqual([true, true, false, false, false, false, false]);
    expect(Object.keys(events[2] ?? {}).sort()).toEqual(["item_id", "kind", "occurred_at"]);
  });

  it("with item events, reference events and refused items mixed: the body meets the contract and each event has exactly one of item_id and external_ref", () => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    reporter.trackLinkClick({ id: ID });
    reporter.trackLinkClick({ externalRef: "telegram:addis_news/10234" }, { placementId: "telegram", actorRef: "device-abc", sessionId: "s-7f3a91c2" });
    reporter.trackLinkClick({ externalRef: "x".repeat(128) });
    reporter.trackLinkClick({ id: null, externalRef: "Telegram:Case_Kept" });
    reporter.watchView({}, { externalRef: "telegram:addis_news/1" });
    f.observers()[0]?.emit(0.9);
    f.clock.advance(1000);
    for (const bad of [{ externalRef: "" }, { externalRef: "x".repeat(129) }, { externalRef: "a b" }, { externalRef: "é" }, { externalRef: 5 }, { id: ID, externalRef: "a" }, { id: "abc", externalRef: "a" }, {}]) {
      reporter.trackLinkClick(bad);
    }
    f.clock.advance(2000);
    const sent = bodies(f);
    expect(sent).toHaveLength(1);
    expect(problemsOf(sent[0])).toEqual([]);
    const events = (sent[0] as { events: Record<string, unknown>[] }).events;
    expect(events).toHaveLength(5);
    expect(events.map((e) => ["item_id" in e, "external_ref" in e])).toEqual([[true, false], [false, true], [false, true], [false, true], [false, true]]);
    expect(events[3]?.external_ref).toBe("Telegram:Case_Kept");
  });

  it("for 50 events in one request, and for the 51st in the next", () => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    for (let n = 0; n < 51; n++) reporter.trackLinkClick({ id: ID });
    f.clock.advance(2000);
    const sent = bodies(f);
    expect(sent.map((body) => (body as { events: unknown[] }).events.length)).toEqual([50, 1]);
    sent.forEach((body) => expect(problemsOf(body)).toEqual([]));
  });

  it("through the fetch fallback too", () => {
    const f = fakeEnv({ beacon: false });
    createReporter(target, f.env).trackLinkClick({ id: ID });
    f.clock.advance(2000);
    expect(f.fetches).toHaveLength(1);
    expect(problemsOf(JSON.parse(f.fetches[0]?.init.body ?? ""))).toEqual([]);
    expect(f.fetches[0]?.init.headers["content-type"]).toBe("text/plain;charset=UTF-8");
  });

  it("and never sends an event whose item id is not a UUID", () => {
    const f = fakeEnv();
    const reporter = createReporter(target, f.env);
    for (const id of ["abc", "", 5, undefined, `${ID}x`]) reporter.trackLinkClick({ id });
    reporter.trackLinkClick({ id: ID });
    f.clock.advance(2000);
    const sent = bodies(f);
    expect((sent[0] as { events: unknown[] }).events).toHaveLength(1);
    expect(problemsOf(sent[0])).toEqual([]);
  });
});
