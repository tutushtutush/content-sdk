import type { FetchInit, ObserverConstructor, ObserverEntryLike, ReportEnv } from "../../../src/events/env";

/** A clock and timers the test moves by hand, in order. */
export function fakeClock(start = Date.UTC(2026, 10, 17, 8, 0, 0)) {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => now,
    setTimeout(run: () => void, ms: number): unknown {
      const id = nextId++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimeout(handle: unknown): void {
      timers.delete(handle as number);
    },
    /** Moves time forward, running every timer that falls due, in order, as they fall due. */
    advance(ms: number): void {
      const target = now + ms;
      for (;;) {
        let due: [number, { at: number; run: () => void }] | undefined;
        for (const entry of timers) if (entry[1].at <= target && (due === undefined || entry[1].at < due[1].at)) due = entry;
        if (due === undefined) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

export class FakeObserver {
  static instances: FakeObserver[] = [];
  observed: unknown[] = [];
  disconnected = false;
  constructor(
    private readonly callback: (entries: ObserverEntryLike[]) => void,
    readonly options: { threshold: number | number[] },
  ) {
    FakeObserver.instances.push(this);
  }
  observe(element: unknown): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  emit(ratio: number, isIntersecting = ratio > 0): void {
    this.callback([{ isIntersecting, intersectionRatio: ratio }]);
  }
}

export interface Fakes {
  env: ReportEnv;
  clock: ReturnType<typeof fakeClock>;
  warnings: string[];
  beacons: { url: string; body: string }[];
  fetches: { url: string; init: FetchInit }[];
  /** Simulates the page being hidden or left. */
  hide(): void;
  hiddenSubscriptions: number;
  observers(): FakeObserver[];
}

/** A report environment made of fakes. `beacon` decides what the beacon returns; leave it out for "taken". */
export function fakeEnv(options: { beacon?: false | ((url: string, body: string) => boolean); fetch?: false | ((url: string, init: FetchInit) => unknown); observer?: boolean | ObserverConstructor } = {}): Fakes {
  FakeObserver.instances = [];
  const clock = fakeClock();
  const warnings: string[] = [];
  const beacons: { url: string; body: string }[] = [];
  const fetches: { url: string; init: FetchInit }[] = [];
  const listeners: (() => void)[] = [];
  const fakes: Fakes = {
    clock,
    warnings,
    beacons,
    fetches,
    hiddenSubscriptions: 0,
    hide: () => listeners.forEach((listener) => listener()),
    observers: () => FakeObserver.instances,
    env: {
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      warn: (text) => warnings.push(text),
      onPageHidden: (listener) => {
        fakes.hiddenSubscriptions += 1;
        listeners.push(listener);
      },
    },
  };
  if (options.beacon !== false) {
    const decide = options.beacon ?? (() => true);
    fakes.env.sendBeacon = (url, body) => {
      beacons.push({ url, body });
      return decide(url, body);
    };
  }
  if (options.fetch !== false) {
    const decide = options.fetch ?? (() => Promise.resolve({}));
    fakes.env.fetch = (url, init) => {
      fetches.push({ url, init });
      return decide(url, init);
    };
  }
  if (options.observer !== false) fakes.env.IntersectionObserver = typeof options.observer === "function" ? options.observer : (FakeObserver as unknown as ObserverConstructor);
  return fakes;
}
