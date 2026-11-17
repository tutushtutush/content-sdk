import { isRecord } from "../guards";

export type EventKind = "view" | "link_click";

/** One event as the service takes it (its events contract). Optional keys are present only when kept. */
export interface EventRecord {
  kind: EventKind;
  item_id: string;
  occurred_at: string;
  placement_id?: string;
  actor_ref?: string;
  session_id?: string;
}

export interface Built {
  event: EventRecord | undefined;
  warnings: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEMENT = /^[a-z0-9-]{3,40}$/;
const ACTOR_MAX = 128;
const SESSION_MAX = 128;

const PREFIX = "[content-sdk]";

/** What the service refuses, refused here first: it refuses a whole batch for one bad value (research R4). */
export function eventFor(kind: EventKind, item: unknown, options: unknown, now: number): Built {
  const warnings: string[] = [];

  let id: unknown;
  try {
    id = isRecord(item) ? item.id : undefined;
  } catch {
    return { event: undefined, warnings: [`${PREFIX} The item could not be read; no ${kind} event was recorded.`] };
  }
  if (typeof id !== "string" || !UUID.test(id)) {
    return { event: undefined, warnings: [`${PREFIX} The item needs an id that is a UUID, as fetchPage returns it; no ${kind} event was recorded.`] };
  }

  const event: EventRecord = { kind, item_id: id, occurred_at: new Date(now).toISOString() };

  let placementId: unknown;
  let actorRef: unknown;
  let sessionId: unknown;
  if (options !== undefined) {
    if (!isRecord(options)) {
      warnings.push(`${PREFIX} The options must be an object; they were ignored.`);
    } else {
      try {
        placementId = options.placementId;
      } catch {
        warnings.push(`${PREFIX} placementId could not be read; it was left out.`);
      }
      try {
        actorRef = options.actorRef;
      } catch {
        warnings.push(`${PREFIX} actorRef could not be read; it was left out.`);
      }
      try {
        sessionId = options.sessionId;
      } catch {
        warnings.push(`${PREFIX} sessionId could not be read; it was left out.`);
      }
    }
  }

  if (placementId !== undefined) {
    if (typeof placementId === "string" && PLACEMENT.test(placementId)) event.placement_id = placementId;
    else warnings.push(`${PREFIX} placementId must be 3 to 40 characters of a-z, 0-9 and -; it was left out.`);
  }
  if (actorRef !== undefined) {
    if (typeof actorRef === "string" && [...actorRef].length >= 1 && [...actorRef].length <= ACTOR_MAX && !actorRef.includes("\u0000")) event.actor_ref = actorRef;
    else warnings.push(`${PREFIX} actorRef must be 1 to ${ACTOR_MAX} characters of text; it was left out.`);
  }

  // The visit, as the platform names it (spec 005): sent as given, never made or kept here. null is none.
  if (sessionId !== undefined && sessionId !== null) {
    if (typeof sessionId === "string" && [...sessionId].length >= 1 && [...sessionId].length <= SESSION_MAX && !sessionId.includes("\u0000")) event.session_id = sessionId;
    else warnings.push(`${PREFIX} sessionId must be 1 to ${SESSION_MAX} characters of text; it was left out.`);
  }

  return { event, warnings };
}
