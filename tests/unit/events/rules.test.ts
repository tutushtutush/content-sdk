import { eventFor } from "../../../src/events/rules";

const ID = "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10";
const NOW = Date.UTC(2026, 10, 17, 8, 0, 0, 123);
const item = { id: ID, title: "Bike" };

describe("eventFor", () => {
  it("builds a view and a link_click with the item's id as given and the time as an ISO string", () => {
    expect(eventFor("view", item, undefined, NOW)).toEqual({ event: { kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" }, warnings: [] });
    expect(eventFor("link_click", item, undefined, NOW).event).toEqual({ kind: "link_click", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
  });

  it("accepts upper-case and lower-case UUIDs and sends the id exactly as given", () => {
    const upper = ID.toUpperCase();
    expect(eventFor("view", { id: upper }, undefined, NOW).event?.item_id).toBe(upper);
  });

  it.each([
    ["not an object", "x"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 5],
    ["an array", [{ id: ID }]],
    ["with no id", {}],
    ["with an empty id", { id: "" }],
    ["with a number as id", { id: 5 }],
    ["with an id that is not a UUID", { id: "abc" }],
    ["with a UUID plus a stray character", { id: `${ID}x` }],
    ["with a UUID without its dashes", { id: ID.split("-").join("") }],
  ])("gives no event and one warning for an item %s", (_name, bad) => {
    const result = eventFor("view", bad, undefined, NOW);
    expect(result.event).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^\[content-sdk\] /);
  });

  it("gives no event and one warning when reading the item throws", () => {
    const hostile = {
      get id(): string {
        throw new Error("boom");
      },
    };
    const result = eventFor("view", hostile, undefined, NOW);
    expect(result.event).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
  });

  describe("placementId", () => {
    it.each(["abc", "latest", "home-page", "a1-b2", "x".repeat(40)])("keeps %s", (placementId) => {
      const result = eventFor("view", item, { placementId }, NOW);
      expect(result.event?.placement_id).toBe(placementId);
      expect(result.warnings).toEqual([]);
    });

    it.each([["empty", ""], ["2 characters", "ab"], ["41 characters", "x".repeat(41)], ["upper-case", "Latest"], ["a space", "a b"], ["a dot", "a.b"], ["a number", 5], ["null", null]])(
      "leaves it out with one warning when it is %s, and still gives the event",
      (_name, placementId) => {
        const result = eventFor("view", item, { placementId }, NOW);
        expect(result.event).toEqual({ kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
        expect(result.warnings).toHaveLength(1);
      },
    );
  });

  describe("actorRef", () => {
    it("keeps 1 to 128 characters, counted as characters", () => {
      expect(eventFor("view", item, { actorRef: "d" }, NOW).event?.actor_ref).toBe("d");
      expect(eventFor("view", item, { actorRef: "😀".repeat(128) }, NOW).event?.actor_ref).toBe("😀".repeat(128));
      expect(eventFor("view", item, { actorRef: "é".repeat(128) }, NOW).warnings).toEqual([]);
    });

    it.each([["empty", ""], ["129 characters", "a".repeat(129)], ["129 emoji", "😀".repeat(129)], ["a NUL character", "a\u0000b"], ["a number", 5], ["null", null]])(
      "leaves it out with one warning when it is %s, and still gives the event",
      (_name, actorRef) => {
        const result = eventFor("view", item, { actorRef }, NOW);
        expect(result.event).toEqual({ kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
        expect(result.warnings).toHaveLength(1);
      },
    );
  });

  describe("options", () => {
    it("keeps both when both are good, and puts neither key in when none is kept", () => {
      expect(eventFor("view", item, { placementId: "latest", actorRef: "device-1" }, NOW).event).toEqual({
        kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z", placement_id: "latest", actor_ref: "device-1",
      });
      const none = eventFor("view", item, {}, NOW).event;
      expect(Object.keys(none ?? {}).sort()).toEqual(["item_id", "kind", "occurred_at"]);
    });

    it("accepts undefined options and ignores unknown keys", () => {
      expect(eventFor("view", item, undefined, NOW).warnings).toEqual([]);
      expect(eventFor("view", item, { colour: "red", placementId: "latest" }, NOW).event?.placement_id).toBe("latest");
    });

    it.each([["a string", "latest"], ["a number", 5], ["an array", ["latest"]], ["null", null]])("gives one warning, ignores them and still gives the event when they are %s", (_name, options) => {
      const result = eventFor("view", item, options, NOW);
      expect(result.event).toEqual({ kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
      expect(result.warnings).toHaveLength(1);
    });

    it("leaves a value out with one warning when reading the options throws", () => {
      const hostile = {
        get placementId(): string {
          throw new Error("boom");
        },
        actorRef: "device-1",
      };
      const result = eventFor("view", item, hostile, NOW);
      expect(result.event).toMatchObject({ item_id: ID, actor_ref: "device-1" });
      expect(result.event).not.toHaveProperty("placement_id");
      expect(result.warnings).toHaveLength(1);
    });
  });
});

describe("eventFor: the session id (spec 005)", () => {
  const sessionOf = (sessionId: unknown, kind: "view" | "link_click" = "view") => eventFor(kind, item, { sessionId }, NOW);

  it.each(["view", "link_click"] as const)("sends a valid sessionId as session_id on a %s, with no warning", (kind) => {
    const built = sessionOf("s-7f3a", kind);
    expect(built.event).toEqual({ kind, item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z", session_id: "s-7f3a" });
    expect(built.warnings).toEqual([]);
  });

  it.each([
    ["case", "S-7f3A"],
    ["spaces", "visit 12 "],
    ["a slash", "a/b"],
    ["non-ASCII letters", "ጉብኝት é"],
    ["128 characters", "x".repeat(128)],
    ["128 emoji, counted as characters", "😀".repeat(128)],
    ["one character", "a"],
  ])("keeps a sessionId with %s exactly as given", (_name, value) => {
    expect(sessionOf(value).event?.session_id).toBe(value);
    expect(sessionOf(value).warnings).toEqual([]);
  });

  it("sits beside placement_id and actor_ref, and none affects another", () => {
    const built = eventFor("view", item, { placementId: "latest", actorRef: "device-1", sessionId: "s-1" }, NOW);
    expect(built.event).toMatchObject({ placement_id: "latest", actor_ref: "device-1", session_id: "s-1" });
    expect(built.warnings).toEqual([]);
    const bad = eventFor("view", item, { placementId: "ab", actorRef: "", sessionId: "s-1" }, NOW);
    expect(bad.event?.session_id).toBe("s-1");
    expect(bad.event?.placement_id).toBeUndefined();
    expect(bad.event?.actor_ref).toBeUndefined();
    expect(bad.warnings).toHaveLength(2);
  });

  it("sends a sessionId equal to the actorRef as given", () => {
    expect(eventFor("view", item, { actorRef: "same", sessionId: "same" }, NOW).event).toMatchObject({ actor_ref: "same", session_id: "same" });
  });

  it.each([
    ["empty", ""],
    ["129 characters", "x".repeat(129)],
    ["129 emoji", "😀".repeat(129)],
    ["holding a NUL", "a\u0000b"],
    ["a number", 7],
    ["a boolean", true],
    ["an object", { id: "a" }],
    ["a list", ["a"]],
    ["a function", () => "a"],
  ])("leaves out a sessionId that is %s, with one warning, and still builds the event", (_name, bad) => {
    const built = sessionOf(bad);
    expect(built.event).toEqual({ kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
    expect("session_id" in (built.event ?? {})).toBe(false);
    expect(built.warnings).toEqual(["[content-sdk] sessionId must be 1 to 128 characters of text with no NUL; it was left out."]);
  });

  it("never puts the value given in a warning", () => {
    const secret = "visit-secret-value-";
    const tooLong = sessionOf(secret.repeat(10));
    const withNul = sessionOf(`${secret}\u0000`);
    for (const built of [tooLong, withNul]) {
      expect(built.warnings).toHaveLength(1);
      expect(built.warnings.join(" ")).not.toContain("secret");
    }
  });

  it("leaves out a sessionId that cannot be read, with one warning and no throw", () => {
    const options = {
      get sessionId(): string {
        throw new Error("no access");
      },
    };
    const built = eventFor("view", item, options, NOW);
    expect(built.event).toEqual({ kind: "view", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" });
    expect(built.warnings).toEqual(["[content-sdk] sessionId could not be read; it was left out."]);
  });

  it("reads no sessionId from options that are not an object, and keeps the one existing warning", () => {
    const built = eventFor("view", item, "s-1", NOW);
    expect(built.event?.session_id).toBeUndefined();
    expect(built.warnings).toEqual(["[content-sdk] The options must be an object; they were ignored."]);
  });

  it.each([
    ["no options", undefined],
    ["empty options", {}],
    ["an undefined sessionId", { sessionId: undefined }],
    ["a null sessionId", { sessionId: null }],
  ])("builds exactly what v0.4.0 built, with no session_id key and no warning, for %s", (_name, options) => {
    const built = eventFor("link_click", item, options, NOW);
    expect(built).toEqual({ event: { kind: "link_click", item_id: ID, occurred_at: "2026-11-17T08:00:00.123Z" }, warnings: [] });
    expect("session_id" in (built.event ?? {})).toBe(false);
    expect(JSON.stringify(built.event)).toBe(`{"kind":"link_click","item_id":"${ID}","occurred_at":"2026-11-17T08:00:00.123Z"}`);
  });

  it("still warns about actorRef: null, as v0.4.0 does", () => {
    const built = eventFor("view", item, { actorRef: null }, NOW);
    expect(built.warnings).toEqual(["[content-sdk] actorRef must be 1 to 128 characters of text; it was left out."]);
  });
});

// Spec 008: an item may name something the platform keeps itself, by an externalRef.
describe("eventFor: external references (spec 008)", () => {
  const REF = "telegram:addis_news/10234";
  const NOWISO = "2026-11-17T08:00:00.123Z";

  it("builds a reference event with external_ref and no item_id, for a view and a link_click", () => {
    for (const kind of ["view", "link_click"] as const) {
      const built = eventFor(kind, { externalRef: REF }, undefined, NOW);
      expect(built).toEqual({ event: { kind, external_ref: REF, occurred_at: NOWISO }, warnings: [] });
      expect("item_id" in (built.event ?? {})).toBe(false);
      expect(JSON.stringify(built.event)).toBe(`{"kind":"${kind}","external_ref":"${REF}","occurred_at":"${NOWISO}"}`);
    }
  });

  it("keeps the reference as given: case, punctuation, digits and exactly 128 characters", () => {
    for (const ref of ["Telegram:A_b.C/d-9", "a", "x".repeat(128), "0", ".:/-_"]) {
      expect(eventFor("view", { externalRef: ref }, undefined, NOW).event).toMatchObject({ external_ref: ref });
    }
  });

  it("works with the options as for an item, sends no placement it was not given, and no event_id", () => {
    const withAll = eventFor("view", { externalRef: REF }, { placementId: "telegram", actorRef: "d", sessionId: "s-1" }, NOW).event;
    expect(withAll).toEqual({ kind: "view", external_ref: REF, occurred_at: NOWISO, placement_id: "telegram", actor_ref: "d", session_id: "s-1" });
    const none = eventFor("view", { externalRef: REF }, {}, NOW).event;
    expect(Object.keys(none ?? {}).sort()).toEqual(["external_ref", "kind", "occurred_at"]);
  });

  const SECRET = "SECRET-VALUE";
  it.each([
    ["empty", ""],
    ["129 characters", "x".repeat(129)],
    ["with a space", "a b"],
    ["with an accented letter", "é"],
    ["with an emoji", "😀"],
    ["with a NUL", "a\u0000b"],
    ["with a trailing newline", "a\n"],
    ["with a character outside the set", `${SECRET}#`],
    ["a number", 7],
    ["a boolean", true],
    ["an object", { toString: () => SECRET }],
    ["a list", [SECRET]],
    ["a function", () => SECRET],
    ["a symbol", Symbol(SECRET)],
  ])("gives no event and one warning without the value for an externalRef that is %s", (_name, bad) => {
    const built = eventFor("view", { externalRef: bad }, undefined, NOW);
    expect(built.event).toBeUndefined();
    expect(built.warnings).toHaveLength(1);
    expect(built.warnings[0]).toMatch(/^\[content-sdk\] externalRef must be 1 to 128 characters/);
    expect(built.warnings[0]).not.toContain(SECRET);
  });

  it("gives one warning when reading externalRef throws", () => {
    const hostile = {
      get externalRef(): string {
        throw new Error("boom");
      },
    };
    const built = eventFor("view", hostile, undefined, NOW);
    expect(built.event).toBeUndefined();
    expect(built.warnings).toHaveLength(1);
  });

  it.each([
    ["a UUID id", { id: ID, externalRef: REF }],
    ["an id that is not a UUID", { id: "abc", externalRef: REF }],
    ["an empty id", { id: "", externalRef: REF }],
    ["a number as id", { id: 5, externalRef: REF }],
    ["a bad reference too", { id: ID, externalRef: "a b" }],
  ])("refuses an item with both, with %s: no event, one warning, no value", (_name, both) => {
    const built = eventFor("view", both, undefined, NOW);
    expect(built.event).toBeUndefined();
    expect(built.warnings).toHaveLength(1);
    expect(built.warnings[0]).toContain("not both");
    expect(built.warnings[0]).not.toContain(REF);
  });

  it.each([
    ["nothing", {}],
    ["other keys only", { title: "Bike" }],
    ["undefined for both", { id: undefined, externalRef: undefined }],
    ["null for both", { id: null, externalRef: null }],
  ])("refuses an item with neither (%s): no event, one warning", (_name, neither) => {
    const built = eventFor("view", neither, undefined, NOW);
    expect(built.event).toBeUndefined();
    expect(built.warnings).toHaveLength(1);
    expect(built.warnings[0]).toContain("externalRef");
  });

  it("counts null as not given, for either field", () => {
    expect(eventFor("view", { id: null, externalRef: REF }, undefined, NOW).event).toMatchObject({ external_ref: REF });
    expect(eventFor("view", { id: ID, externalRef: null }, undefined, NOW).event).toMatchObject({ item_id: ID });
  });

  it("keeps the item refusal for a bad id alone, and the item event as v0.7.0 built it, extra keys included", () => {
    expect(eventFor("view", { id: "abc" }, undefined, NOW).event).toBeUndefined();
    const fetched = { id: ID, title: "Bike", view_count: 3 };
    const built = eventFor("view", fetched, undefined, NOW);
    expect(JSON.stringify(built.event)).toBe(`{"kind":"view","item_id":"${ID}","occurred_at":"${NOWISO}"}`);
    expect(built.warnings).toEqual([]);
  });

  it("has options warnings as before for a reference event", () => {
    const built = eventFor("view", { externalRef: REF }, { placementId: "X", actorRef: "", sessionId: "" }, NOW);
    expect(built.event).toEqual({ kind: "view", external_ref: REF, occurred_at: NOWISO });
    expect(built.warnings).toHaveLength(3);
  });
});

// Spec 009: the platform's own key for one event.
describe("eventFor: eventId (spec 009)", () => {
  const KEY = "5b2f0c4e-9d1a-4e0b-8f7a-3c1d2e4f5a6b";
  const REF = "telegram:addis_news/10234";
  const NOWISO = "2026-11-17T08:00:00.123Z";

  it("sends a valid key as event_id for an item and for a reference, view and link_click", () => {
    for (const kind of ["view", "link_click"] as const) {
      expect(eventFor(kind, item, { eventId: KEY }, NOW)).toEqual({ event: { kind, item_id: ID, occurred_at: NOWISO, event_id: KEY }, warnings: [] });
      expect(eventFor(kind, { externalRef: REF }, { eventId: KEY }, NOW)).toEqual({ event: { kind, external_ref: REF, occurred_at: NOWISO, event_id: KEY }, warnings: [] });
    }
  });

  it.each(["k", "Post-42", "view:telegram:addis_news.10234:k7", "a_b.c:d-e", "0", "x".repeat(128), "A", "a"])("keeps %s as given", (key) => {
    expect(eventFor("view", item, { eventId: key }, NOW).event?.event_id).toBe(key);
  });

  it("keeps two keys that differ only in case apart", () => {
    expect(eventFor("view", item, { eventId: "Key" }, NOW).event?.event_id).toBe("Key");
    expect(eventFor("view", item, { eventId: "key" }, NOW).event?.event_id).toBe("key");
  });

  it("sits beside the other options and none affects another; equal to sessionId or actorRef is allowed", () => {
    const all = eventFor("view", item, { placementId: "latest", actorRef: "d", sessionId: "s-1", eventId: KEY }, NOW).event;
    expect(all).toEqual({ kind: "view", item_id: ID, occurred_at: NOWISO, placement_id: "latest", actor_ref: "d", session_id: "s-1", event_id: KEY });
    const same = eventFor("view", item, { actorRef: "x", sessionId: "x", eventId: "x" }, NOW).event;
    expect(same).toMatchObject({ actor_ref: "x", session_id: "x", event_id: "x" });
  });

  const SECRET = "SECRET-VALUE";
  it.each([
    ["empty", ""],
    ["129 characters", "x".repeat(129)],
    ["129 emoji", "😀".repeat(129)],
    ["with a space", "a b"],
    ["with a slash", "a/b"],
    ["with an accented letter", "é"],
    ["with an emoji", "😀"],
    ["with a NUL", "a\u0000b"],
    ["with a trailing newline", "a\n"],
    ["with a character outside the set", `${SECRET}#`],
    ["a number", 7],
    ["a boolean", true],
    ["an object", { toString: () => SECRET }],
    ["a list", [SECRET]],
    ["a function", () => SECRET],
    ["a symbol", Symbol(SECRET)],
  ])("leaves out an eventId that is %s, with one warning that never holds the value, and still builds the event", (_name, bad) => {
    for (const subject of [item, { externalRef: REF }]) {
      const built = eventFor("view", subject, { eventId: bad }, NOW);
      expect(built.event).toBeDefined();
      expect("event_id" in (built.event ?? {})).toBe(false);
      expect(built.warnings).toEqual(["[content-sdk] eventId must be 1 to 128 characters of A-Z, a-z, 0-9 and _ . : -; it was left out."]);
      expect(built.warnings[0]).not.toContain(SECRET);
    }
  });

  it("leaves out an eventId whose getter throws, with one warning", () => {
    const options = {
      get eventId(): string {
        throw new Error("boom");
      },
    };
    const built = eventFor("view", item, options, NOW);
    expect(built.event).toEqual({ kind: "view", item_id: ID, occurred_at: NOWISO });
    expect(built.warnings).toEqual(["[content-sdk] eventId could not be read; it was left out."]);
  });

  it("is independent of the other options: a bad key does not change them, and a bad one of them does not change a good key", () => {
    const a = eventFor("view", item, { eventId: "a b", placementId: "latest", sessionId: "s-1" }, NOW);
    expect(a.event).toEqual({ kind: "view", item_id: ID, occurred_at: NOWISO, placement_id: "latest", session_id: "s-1" });
    expect(a.warnings).toHaveLength(1);
    const b = eventFor("view", item, { eventId: KEY, placementId: "X", actorRef: "", sessionId: "" }, NOW);
    expect(b.event).toEqual({ kind: "view", item_id: ID, occurred_at: NOWISO, event_id: KEY });
    expect(b.warnings).toHaveLength(3);
  });

  it("reads no eventId from options that are not an object, and keeps the one existing warning", () => {
    const built = eventFor("view", item, KEY, NOW);
    expect(built.event?.event_id).toBeUndefined();
    expect(built.warnings).toEqual(["[content-sdk] The options must be an object; they were ignored."]);
  });

  it.each([
    ["no options", undefined],
    ["empty options", {}],
    ["an undefined eventId", { eventId: undefined }],
    ["a null eventId", { eventId: null }],
  ])("builds exactly what v0.8.0 built, with no event_id key and no warning, for %s", (_name, options) => {
    const asItem = eventFor("link_click", item, options, NOW);
    expect(asItem).toEqual({ event: { kind: "link_click", item_id: ID, occurred_at: NOWISO }, warnings: [] });
    expect(JSON.stringify(asItem.event)).toBe(`{"kind":"link_click","item_id":"${ID}","occurred_at":"${NOWISO}"}`);
    const asRef = eventFor("link_click", { externalRef: REF }, options, NOW);
    expect(JSON.stringify(asRef.event)).toBe(`{"kind":"link_click","external_ref":"${REF}","occurred_at":"${NOWISO}"}`);
    expect(asRef.warnings).toEqual([]);
  });

  it("still warns about actorRef: null, as v0.8.0 does", () => {
    expect(eventFor("view", item, { actorRef: null }, NOW).warnings).toEqual(["[content-sdk] actorRef must be 1 to 128 characters of text; it was left out."]);
  });
});
