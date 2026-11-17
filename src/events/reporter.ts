import type { ReportTarget } from "../types";
import { createBatcher } from "./batcher";
import type { ReportEnv } from "./env";
import { eventFor, type EventKind, type EventRecord } from "./rules";
import { createTransport } from "./transport";
import { startWatch } from "./watch";

export interface Reporter {
  /** Reports one `view` of the item when the element has been seen; returns `stop`. Never throws. */
  watchView(element: unknown, item: unknown, options?: unknown): () => void;
  /** Reports one `link_click` of the item. Never throws. */
  trackLinkClick(item: unknown, options?: unknown): void;
}

/** The two calls of one target, over one batcher, one transport and the given environment. */
export function createReporter(target: ReportTarget, env: ReportEnv): Reporter {
  // A console or a timer clear that throws must not break anything the reporter does.
  const safe: ReportEnv = {
    ...env,
    clearTimeout: (handle) => {
      try {
        env.clearTimeout(handle);
      } catch {
        // A timer that cannot be cleared will find its work already done.
      }
    },
    warn: (text) => {
      try {
        env.warn(text);
      } catch {
        // Nothing to do about a broken console.
      }
    },
  };
  const transport = createTransport(target, safe);
  const batcher = createBatcher((events) => transport.send(events), safe);
  let subscribed = false;

  function queue(event: EventRecord): void {
    batcher.add(event);
    // The page-hidden signal is the one listener the SDK adds, and only once an event exists.
    if (!subscribed && safe.onPageHidden !== undefined) {
      subscribed = true;
      try {
        safe.onPageHidden(batcher.pageHidden);
      } catch {
        // Without it events still leave after their wait.
      }
    }
  }

  function build(kind: EventKind, item: unknown, options: unknown) {
    const built = eventFor(kind, item, options, safe.now());
    for (const warning of built.warnings) safe.warn(warning);
    return built.event;
  }

  return {
    watchView(element, item, options) {
      const nothing = () => undefined;
      try {
        if (typeof element !== "object" || element === null) {
          safe.warn("[content-sdk] watchView needs the element that was rendered for the item; nothing is watched.");
          return nothing;
        }
        const event = build("view", item, options);
        if (event === undefined) return nothing;
        return startWatch(safe, element, () => queue({ ...event, occurred_at: new Date(safe.now()).toISOString() }));
      } catch (cause) {
        safe.warn(`[content-sdk] watchView failed: ${cause instanceof Error ? cause.message.slice(0, 200) : "unknown"}`);
        return nothing;
      }
    },

    trackLinkClick(item, options) {
      try {
        const event = build("link_click", item, options);
        if (event !== undefined) queue(event);
      } catch (cause) {
        safe.warn(`[content-sdk] trackLinkClick failed: ${cause instanceof Error ? cause.message.slice(0, 200) : "unknown"}`);
      }
    },
  };
}
