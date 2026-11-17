// What the loader needs from the page, as small structural types. No DOM library types,
// so tests pass plain objects and a stray DOM use elsewhere still fails to compile.

import type { PageGlobals } from "../events/page-env";

export interface ScriptLike {
  getAttribute(name: string): string | null;
}

// Beside its own script tag, the loader hands the reporter the few page members it needs (timers, the
// visibility observer, the beacon, fetch and the page-hidden signals), all optional.
export interface Env extends PageGlobals {
  document?: {
    currentScript?: ScriptLike | null;
    visibilityState?: string;
    addEventListener?: (type: string, listener: () => void) => void;
  };
  console?: { warn?: (text: string) => void };
  /** The page's stub; the loader creates it when the page has none. */
  contentSdk?: unknown;
}

export interface Settings {
  baseUrl: string;
  platformId: string;
}
