import type { FetchInit, ObserverConstructor, ReportEnv } from "./env";

/**
 * The page's globals the reporter may use, all optional. This is the one place the reporter reads the
 * page (the loader's `Env` has the same members), so every other module can be tested with plain fakes.
 */
export interface PageGlobals {
  setTimeout?: (callback: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  IntersectionObserver?: ObserverConstructor;
  navigator?: { sendBeacon?: (url: string, body: string) => boolean };
  fetch?: (url: string, init: FetchInit) => unknown;
  addEventListener?: (type: string, listener: () => void) => void;
  document?: { visibilityState?: string; addEventListener?: (type: string, listener: () => void) => void };
  console?: { warn?: (text: string) => void };
}

/** Builds the reporter's environment from the page's globals. Reads nothing until a member is used. */
export function pageEnv(page: PageGlobals): ReportEnv {
  const env: ReportEnv = {
    now: () => Date.now(),
    setTimeout: (callback, ms) => (typeof page.setTimeout === "function" ? page.setTimeout(callback, ms) : undefined),
    clearTimeout: (handle) => {
      if (typeof page.clearTimeout === "function") page.clearTimeout(handle);
    },
    warn: (text) => {
      try {
        page.console?.warn?.(text);
      } catch {
        // A broken console must not break the page.
      }
    },
  };
  if (typeof page.IntersectionObserver === "function") env.IntersectionObserver = page.IntersectionObserver;
  const navigator = page.navigator;
  if (navigator !== undefined && typeof navigator.sendBeacon === "function") env.sendBeacon = (url, body) => navigator.sendBeacon?.(url, body) === true;
  if (typeof page.fetch === "function") env.fetch = (url, init) => page.fetch?.(url, init);
  if (typeof page.addEventListener === "function" || typeof page.document?.addEventListener === "function") {
    env.onPageHidden = (listener) => {
      // Browsers differ on which of these fires when a tab is closed or sent to the background.
      try {
        page.addEventListener?.("pagehide", listener);
      } catch {
        // The other signal may still work.
      }
      try {
        const document = page.document;
        document?.addEventListener?.("visibilitychange", () => {
          if (document.visibilityState === "hidden") listener();
        });
      } catch {
        // Events still leave after their wait.
      }
    };
  }
  return env;
}
