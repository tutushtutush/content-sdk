import type { ReportedItem, ReportTarget, ViewOptions } from "../types";
import { isRecord } from "../guards";
import { pageEnv, type PageGlobals } from "./page-env";
import { createReporter, type Reporter } from "./reporter";

export interface Library {
  /** Reports one `view` of the item when the element has been seen on screen; returns `stop`. Never throws. */
  watchView(target: ReportTarget, element: object, item: ReportedItem, options?: ViewOptions): () => void;
  /** Reports one `link_click` of the item. Never throws. */
  trackLinkClick(target: ReportTarget, item: ReportedItem, options?: ViewOptions): void;
}

/**
 * The library form of the two calls: a target first, one reporter (so one batch) per service address
 * and platform, made on first use from the page's globals. Where the page has no observer (Node),
 * `watchView` does nothing and `trackLinkClick` still sends.
 */
export function createLibrary(page: PageGlobals): Library {
  const reporters = new Map<string, Reporter>();

  function reporterFor(target: unknown): Reporter | undefined {
    try {
      if (!isRecord(target)) throw new Error("the target must be an object with baseUrl and platformId");
      const key = `${String(target.baseUrl)}\u0000${String(target.platformId)}`;
      let reporter = reporters.get(key);
      if (reporter === undefined) {
        reporter = createReporter({ baseUrl: target.baseUrl as string, platformId: target.platformId as string }, pageEnv(page));
        reporters.set(key, reporter);
      }
      return reporter;
    } catch (cause) {
      pageEnv(page).warn(`[content-sdk] ${cause instanceof Error ? cause.message.slice(0, 200) : "The target could not be read"}; nothing is reported.`);
      return undefined;
    }
  }

  return {
    watchView(target, element, item, options) {
      return reporterFor(target)?.watchView(element, item, options) ?? (() => undefined);
    },
    trackLinkClick(target, item, options) {
      reporterFor(target)?.trackLinkClick(item, options);
    },
  };
}
