import { fetchPage as deliveryFetchPage } from "../fetch-page";
import { network } from "../errors";
import { pageEnv } from "../events/page-env";
import { createReporter, type Reporter } from "../events/reporter";
import type { Query, Result } from "../types";
import type { Env, Settings } from "./env";
import { clip, warn } from "./warn";

export interface Deps {
  fetchPage: typeof deliveryFetchPage;
  env: Env;
}

export type FetchPageMethod = (placementId?: unknown, query?: unknown, callback?: unknown) => Promise<Result>;

/** Runs the callback with the result. A missing callback is ignored; a throw or a rejection is one warning. */
function deliver(callback: unknown, result: Result, env: Env): void {
  if (typeof callback !== "function") return;
  const report = (cause: unknown) => warn(env, `[content-sdk] A fetchPage callback threw: ${clip(cause instanceof Error ? cause.message : cause, 200)}`);
  try {
    const returned: unknown = callback(result);
    if (returned !== null && typeof returned === "object" && typeof (returned as PromiseLike<unknown>).then === "function") {
      (returned as PromiseLike<unknown>).then(undefined, report);
    }
  } catch (cause) {
    report(cause);
  }
}

/** The page-facing fetchPage: the tag's settings plus the placement, query and callback of the call. */
export function makeFetchPage(settings: Settings, deps: Deps): FetchPageMethod {
  return async (placementId, query, callback) => {
    let result: Result;
    try {
      result = await deps.fetchPage(
        { baseUrl: settings.baseUrl, platformId: settings.platformId, placementId: placementId as string },
        query as Query | undefined,
      );
    } catch (cause) {
      // The delivery client does not reject; this is only a last guard.
      result = { ok: false, error: network(cause) };
    }
    deliver(callback, result, deps.env);
    return result;
  };
}

/** The reporter of the page's one platform: the tag's address and platform id over the page's own environment. */
export function makeReporter(settings: Settings, env: Env, create: typeof createReporter = createReporter): Reporter {
  return create({ baseUrl: settings.baseUrl, platformId: settings.platformId }, pageEnv(env));
}

export type WatchViewMethod = (element?: unknown, item?: unknown, options?: unknown) => () => void;
export type TrackLinkClickMethod = (item?: unknown, options?: unknown) => void;

/** The page-facing watchView: hands back `stop`. Through the queue the return value is simply dropped. */
export function makeWatchView(reporter: Reporter): WatchViewMethod {
  return (element, item, options) => reporter.watchView(element, item, options);
}

export function makeTrackLinkClick(reporter: Reporter): TrackLinkClickMethod {
  return (item, options) => reporter.trackLinkClick(item, options);
}

export type Command = (...args: unknown[]) => unknown;

const BAD_ENTRY = "[content-sdk] Bad queue entry: expected [name, ...args].";

/** Runs one queue entry `[name, ...args]`. A bad entry or unknown name is one warning, never a throw. */
export function makeRunner(commands: Record<string, Command>, env: Env): (entry: unknown) => void {
  return (entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      warn(env, BAD_ENTRY);
      return;
    }
    const name: string = entry[0];
    // Own names only, so "constructor" or "__proto__" can never be a command.
    if (!Object.prototype.hasOwnProperty.call(commands, name)) {
      warn(env, `[content-sdk] Unknown command: ${clip(name, 40)}`);
      return;
    }
    try {
      commands[name](...entry.slice(1));
    } catch (cause) {
      warn(env, `[content-sdk] Command ${clip(name, 40)} failed: ${clip(cause instanceof Error ? cause.message : cause, 200)}`);
    }
  };
}
