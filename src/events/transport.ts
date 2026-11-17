import { checkBase } from "../request";
import type { ReportTarget } from "../types";
import type { ReportEnv } from "./env";
import type { EventRecord } from "./rules";

export interface Transport {
  /** Sends the events as one request. Never throws, never waits for an answer, never retries. */
  send(events: EventRecord[]): void;
}

const CONTENT_TYPE = "text/plain;charset=UTF-8";

/** Sends batches to the service's events endpoint: a beacon first, one keep-alive fetch if the beacon cannot (research R6). */
export function createTransport(target: ReportTarget, env: ReportEnv): Transport {
  const checked = checkBase(target);
  const url = "error" in checked ? undefined : `${checked.origin}${checked.prefix}/api/v1/events`;
  const platformId = "error" in checked ? "" : checked.platformId;
  let warnedUnusable = false;
  let warnedNoWay = false;

  function sent(body: string): boolean {
    try {
      return env.sendBeacon?.(url as string, body) === true;
    } catch {
      return false;
    }
  }

  function viaFetch(body: string): boolean {
    if (env.fetch === undefined) return false;
    try {
      const answer = env.fetch(url as string, { method: "POST", body, keepalive: true, credentials: "omit", headers: { "content-type": CONTENT_TYPE } });
      // The answer is never read; a rejection must not surface as an unhandled one.
      if (answer !== null && typeof answer === "object" && typeof (answer as PromiseLike<unknown>).then === "function") {
        (answer as PromiseLike<unknown>).then(undefined, () => undefined);
      }
    } catch {
      // A failed send is a lost event, never an error in the page.
    }
    return true;
  }

  return {
    send(events) {
      if (events.length === 0) return;
      if (url === undefined) {
        if (!warnedUnusable) {
          warnedUnusable = true;
          env.warn("[content-sdk] The base address or platform id is unusable; events are not sent.");
        }
        return;
      }
      const body = JSON.stringify({ platform_id: platformId, events });
      if (sent(body)) return;
      if (!viaFetch(body) && !warnedNoWay) {
        warnedNoWay = true;
        env.warn("[content-sdk] Neither a beacon nor fetch is available; events are not sent.");
      }
    },
  };
}
