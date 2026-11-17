import { startWatch } from "../../../src/events/watch";
import { fakeEnv } from "./helpers";

const element = { id: "card" };

function setup(options: Parameters<typeof fakeEnv>[0] = {}) {
  const f = fakeEnv(options);
  const seen: number[] = [];
  const stop = startWatch(f.env, element, () => seen.push(f.clock.now()));
  return { f, seen, stop, observer: () => f.observers()[0] };
}

describe("startWatch: what counts as seen", () => {
  it("makes an observer with a threshold of 0.5 and gives it the element", () => {
    const { observer } = setup();
    expect(observer()?.options).toEqual({ threshold: [0.5] });
    expect(observer()?.observed).toEqual([element]);
  });

  it("reports once, 1000 ms after the element became 60% visible", () => {
    const { f, seen, observer } = setup();
    const start = f.clock.now();
    observer()?.emit(0.6);
    f.clock.advance(999);
    expect(seen).toEqual([]);
    f.clock.advance(1);
    expect(seen).toEqual([start + 1000]);
  });

  it("counts exactly half as visible", () => {
    const { f, seen, observer } = setup();
    observer()?.emit(0.5);
    f.clock.advance(1000);
    expect(seen).toHaveLength(1);
  });

  it("never starts for 40%, or for an element that is not intersecting at all", () => {
    const { f, seen, observer } = setup();
    observer()?.emit(0.4);
    observer()?.emit(0.9, false);
    f.clock.advance(5000);
    expect(seen).toEqual([]);
  });

  it("starts the dwell over when the element dropped below half in between", () => {
    const { f, seen, observer } = setup();
    observer()?.emit(0.6);
    f.clock.advance(600);
    observer()?.emit(0.3);
    f.clock.advance(1000);
    expect(seen).toEqual([]);
    observer()?.emit(0.7);
    f.clock.advance(999);
    expect(seen).toEqual([]);
    f.clock.advance(1);
    expect(seen).toHaveLength(1);
  });

  it("does not restart the dwell when another entry at half or more arrives during it", () => {
    const { f, seen, observer } = setup();
    observer()?.emit(0.6);
    f.clock.advance(700);
    observer()?.emit(0.8);
    f.clock.advance(300);
    expect(seen).toHaveLength(1);
  });

  it("reports once however long the element stays visible, then lets everything go", () => {
    const { f, seen, observer } = setup();
    observer()?.emit(0.6);
    f.clock.advance(1000);
    f.clock.advance(60_000);
    observer()?.emit(0.9);
    f.clock.advance(5000);
    expect(seen).toHaveLength(1);
    expect(observer()?.disconnected).toBe(true);
    expect(f.clock.pending()).toBe(0);
  });
});

describe("startWatch: giving up and stopping", () => {
  it("gives up 120000 ms after it began, disconnects, and reports nothing", () => {
    const { f, seen, observer } = setup();
    f.clock.advance(119_999);
    expect(observer()?.disconnected).toBe(false);
    f.clock.advance(1);
    expect(observer()?.disconnected).toBe(true);
    expect(seen).toEqual([]);
    expect(f.clock.pending()).toBe(0);
  });

  it("cuts off a dwell that began at 119500 ms: the give-up lands first and nothing is reported", () => {
    const { f, seen, observer } = setup();
    f.clock.advance(119_500);
    observer()?.emit(0.9);
    f.clock.advance(1000);
    expect(seen).toEqual([]);
    expect(observer()?.disconnected).toBe(true);
    expect(f.clock.pending()).toBe(0);
  });

  it("reports nothing after the give-up even if an entry arrives later", () => {
    const { f, seen, observer } = setup();
    f.clock.advance(120_000);
    observer()?.emit(0.9);
    f.clock.advance(5000);
    expect(seen).toEqual([]);
  });

  it("stop before the report cancels both timers, disconnects, and nothing is reported", () => {
    const { f, seen, stop, observer } = setup();
    observer()?.emit(0.6);
    f.clock.advance(500);
    stop();
    f.clock.advance(200_000);
    expect(seen).toEqual([]);
    expect(observer()?.disconnected).toBe(true);
    expect(f.clock.pending()).toBe(0);
  });

  it("stop twice, and stop after the report, do nothing", () => {
    const { f, seen, stop, observer } = setup();
    stop();
    expect(() => stop()).not.toThrow();
    const second = setup();
    second.observer()?.emit(0.6);
    second.f.clock.advance(1000);
    expect(() => second.stop()).not.toThrow();
    expect(second.seen).toHaveLength(1);
    expect(seen).toEqual([]);
    expect(observer()?.disconnected).toBe(true);
    expect(f.clock.pending()).toBe(0);
  });
});

describe("startWatch: no observer, or one that fails", () => {
  it("does nothing and returns a stop that does nothing when there is no observer constructor", () => {
    const f = fakeEnv({ observer: false });
    const stop = startWatch(f.env, element, () => undefined);
    expect(() => stop()).not.toThrow();
    expect(f.clock.pending()).toBe(0);
  });

  it("does nothing, with no throw and no timer, when the observer constructor throws", () => {
    const Throwing = function (): never {
      throw new Error("no observer for you");
    } as never;
    const f = fakeEnv({ observer: Throwing });
    const stop = startWatch(f.env, element, () => undefined);
    expect(() => stop()).not.toThrow();
    expect(f.clock.pending()).toBe(0);
  });

  it("lets go of what it holds when observe throws", () => {
    class Bad {
      static last: Bad | undefined;
      disconnected = false;
      constructor() {
        Bad.last = this;
      }
      observe(): void {
        throw new Error("bad element");
      }
      disconnect(): void {
        this.disconnected = true;
      }
    }
    const f = fakeEnv({ observer: Bad as never });
    const stop = startWatch(f.env, element, () => undefined);
    expect(() => stop()).not.toThrow();
    expect(Bad.last?.disconnected).toBe(true);
    expect(f.clock.pending()).toBe(0);
  });

  it("catches an observer callback that throws, and a report callback that throws", () => {
    const f = fakeEnv();
    startWatch(f.env, element, () => {
      throw new Error("report failed");
    });
    const observer = f.observers()[0];
    expect(() => observer?.emit(0.6)).not.toThrow();
    expect(() => f.clock.advance(1000)).not.toThrow();
    expect(() => (observer as unknown as { callback: (e: unknown) => void }).callback(null)).not.toThrow();
  });
});
