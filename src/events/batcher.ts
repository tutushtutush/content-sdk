import { BATCH_MAX, FLUSH_DELAY_MS } from "./constants";
import type { ReportEnv } from "./env";
import type { EventRecord } from "./rules";

export interface Batcher {
  add(event: EventRecord): void;
  /** Sends what waits, if anything, and stops the wait. */
  flush(): void;
  /** The page is hidden or being left: the same as flush. */
  pageHidden(): void;
}

/**
 * Collects events and hands them over together: 2 seconds after the first one, at once when 50
 * wait, and when the page is hidden. Never more than 50 in one hand-over, never an empty one.
 */
export function createBatcher(send: (events: EventRecord[]) => void, env: Pick<ReportEnv, "setTimeout" | "clearTimeout">): Batcher {
  const waiting: EventRecord[] = [];
  let timer: unknown;
  let timing = false;

  function stopTimer(): void {
    if (timing) env.clearTimeout(timer);
    timing = false;
  }

  function flush(): void {
    stopTimer();
    if (waiting.length === 0) return;
    const batch = waiting.splice(0, BATCH_MAX);
    try {
      send(batch);
    } catch {
      // A failed send is a lost batch; the queue is already empty and the next event starts fresh.
    }
  }

  return {
    add(event) {
      waiting.push(event);
      if (waiting.length >= BATCH_MAX) {
        flush();
        return;
      }
      if (!timing) {
        // `timing` is set only once the timer exists, so a timer that cannot be made leaves no stale flag.
        timer = env.setTimeout(() => {
          timing = false;
          flush();
        }, FLUSH_DELAY_MS);
        timing = true;
      }
    },
    flush,
    pageHidden: flush,
  };
}
