import { createBatcher } from "../../../src/events/batcher";
import type { EventRecord } from "../../../src/events/rules";
import { fakeClock } from "./helpers";

const event = (n: number): EventRecord => ({ kind: "view", item_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, occurred_at: "2026-11-17T08:00:00.000Z" });

function setup(send?: (events: EventRecord[]) => void) {
  const clock = fakeClock();
  const batches: EventRecord[][] = [];
  const batcher = createBatcher(send ?? ((events) => batches.push(events)), clock);
  return { clock, batches, batcher };
}

describe("createBatcher", () => {
  it("waits 2000 ms after the first event, then sends everything that waited in one call", () => {
    const { clock, batches, batcher } = setup();
    batcher.add(event(1));
    clock.advance(1000);
    batcher.add(event(2));
    batcher.add(event(3));
    clock.advance(999);
    expect(batches).toEqual([]);
    clock.advance(1);
    expect(batches).toEqual([[event(1), event(2), event(3)]]);
  });

  it("counts the wait from the first event, not from the latest", () => {
    const { clock, batches, batcher } = setup();
    batcher.add(event(1));
    clock.advance(1500);
    batcher.add(event(2));
    clock.advance(500);
    expect(batches).toHaveLength(1);
  });

  it("sends at once when the 50th event arrives, and cancels the timer", () => {
    const { clock, batches, batcher } = setup();
    for (let n = 1; n <= 49; n++) batcher.add(event(n));
    expect(batches).toEqual([]);
    batcher.add(event(50));
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(50);
    expect(clock.pending()).toBe(0);
  });

  it("never hands over more than 50: 120 events in a row give 50, 50 and 20, the 20 after their own wait", () => {
    const { clock, batches, batcher } = setup();
    for (let n = 1; n <= 120; n++) batcher.add(event(n));
    expect(batches.map((batch) => batch.length)).toEqual([50, 50]);
    clock.advance(1999);
    expect(batches).toHaveLength(2);
    clock.advance(1);
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(batches.flat().map((e) => e.item_id)).toEqual(Array.from({ length: 120 }, (_, i) => event(i + 1).item_id));
  });

  it("does nothing when asked to flush with nothing waiting", () => {
    const { batches, batcher } = setup();
    batcher.flush();
    batcher.pageHidden();
    expect(batches).toEqual([]);
  });

  it("sends what waits at once when the page is hidden, and cancels the timer", () => {
    const { clock, batches, batcher } = setup();
    batcher.add(event(1));
    batcher.pageHidden();
    expect(batches).toEqual([[event(1)]]);
    expect(clock.pending()).toBe(0);
    clock.advance(10_000);
    expect(batches).toHaveLength(1);
  });

  it("sends nothing however often the page is hidden when nothing waits", () => {
    const { clock, batches, batcher } = setup();
    for (let i = 0; i < 5; i++) {
      batcher.pageHidden();
      clock.advance(2000);
    }
    expect(batches).toEqual([]);
  });

  it("starts a new wait for the first event after a flush", () => {
    const { clock, batches, batcher } = setup();
    batcher.add(event(1));
    clock.advance(2000);
    clock.advance(5000);
    batcher.add(event(2));
    clock.advance(1999);
    expect(batches).toHaveLength(1);
    clock.advance(1);
    expect(batches).toEqual([[event(1)], [event(2)]]);
  });

  it("puts an event added while a send is running into the next batch", () => {
    const batches: EventRecord[][] = [];
    const clock = fakeClock();
    const batcher: ReturnType<typeof createBatcher> = createBatcher((events) => {
      batches.push(events);
      if (batches.length === 1) batcher.add(event(9));
    }, clock);
    batcher.add(event(1));
    clock.advance(2000);
    expect(batches).toEqual([[event(1)]]);
    clock.advance(2000);
    expect(batches).toEqual([[event(1)], [event(9)]]);
  });

  it("leaves nothing running after a flush", () => {
    const { clock, batcher } = setup();
    batcher.add(event(1));
    batcher.flush();
    expect(clock.pending()).toBe(0);
  });

  it("survives a send that throws: the queue is empty and the next event still goes out", () => {
    const batches: EventRecord[][] = [];
    let first = true;
    const clock = fakeClock();
    const batcher = createBatcher((events) => {
      if (first) {
        first = false;
        throw new Error("boom");
      }
      batches.push(events);
    }, clock);
    batcher.add(event(1));
    expect(() => clock.advance(2000)).not.toThrow();
    batcher.add(event(2));
    clock.advance(2000);
    expect(batches).toEqual([[event(2)]]);
  });
});
