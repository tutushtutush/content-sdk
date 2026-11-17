import { DWELL_MS, GIVE_UP_MS, VISIBLE_RATIO } from "./constants";
import type { ObserverLike, ReportEnv } from "./env";

type WatchEnv = Pick<ReportEnv, "setTimeout" | "clearTimeout" | "IntersectionObserver">;

/**
 * Watches one element until it has been at least half visible for one continuous second, then calls
 * `onSeen` once. Gives up (and lets the element go) 120 seconds after it began, whatever else is
 * happening. Returns `stop`, which cancels an open watch and does nothing afterwards. Never throws.
 */
export function startWatch(env: WatchEnv, element: unknown, onSeen: () => void): () => void {
  const nothing = () => undefined;
  if (env.IntersectionObserver === undefined) return nothing;

  let done = false;
  let dwell: unknown;
  let dwelling = false;
  let giveUp: unknown;
  let giveUpSet = false;
  let observer: ObserverLike | undefined;

  function end(): void {
    done = true;
    if (dwelling) env.clearTimeout(dwell);
    dwelling = false;
    if (giveUpSet) env.clearTimeout(giveUp);
    giveUpSet = false;
    try {
      observer?.disconnect();
    } catch {
      // Letting go must not fail the page.
    }
  }

  function seen(): void {
    dwelling = false;
    end();
    try {
      onSeen();
    } catch {
      // The caller's problem is not the page's.
    }
  }

  try {
    observer = new env.IntersectionObserver(
      (entries) => {
        try {
          if (done) return;
          const entry = entries[entries.length - 1];
          const visible = entry !== undefined && entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO;
          if (visible && !dwelling) {
            dwelling = true;
            dwell = env.setTimeout(seen, DWELL_MS);
          } else if (!visible && dwelling) {
            env.clearTimeout(dwell);
            dwelling = false;
          }
        } catch {
          // A callback the browser calls must never throw into the page.
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );
    observer.observe(element);
    giveUp = env.setTimeout(end, GIVE_UP_MS);
    giveUpSet = true;
  } catch {
    end();
    return nothing;
  }

  return () => {
    if (!done) end();
  };
}
