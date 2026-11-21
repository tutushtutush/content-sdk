import { isRecord } from "../guards";

export type EventKind = "view" | "link_click";

interface EventShared {
  kind: EventKind;
  occurred_at: string;
  placement_id?: string;
  actor_ref?: string;
  session_id?: string;
}

/** One event as the service takes it (its events contract): exactly one of `item_id` and `external_ref`. Optional keys are present only when kept. */
export type EventRecord =
  | (EventShared & { item_id: string; external_ref?: never })
  | (EventShared & { external_ref: string; item_id?: never });

export interface Built {
  event: EventRecord | undefined;
  warnings: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTERNAL_REF = /^[A-Za-z0-9_.:/-]{1,128}$/;
const PLACEMENT = /^[a-z0-9-]{3,40}$/;
const ACTOR_MAX = 128;
const SESSION_MAX = 128;

const PREFIX = "[content-sdk]";

/** Opaque text the platform chose (an actor reference, a session id): 1 to `max` characters, counted as characters, no NUL. */
function isOpaqueText(value: unknown, max: number): value is string {
  if (typeof value !== "string" || value.includes("\u0000")) return false;
  const characters = [...value].length;
  return characters >= 1 && characters <= max;
}

/** What the service refuses, refused here first: it refuses a whole batch for one bad value (research R4). */
export function eventFor(kind: EventKind, item: unknown, options: unknown, now: number): Built {
  const warnings: string[] = [];

  // An item names one thing: a content-api item by `id`, or something the platform keeps itself by `externalRef`.
  // null counts as not given, as the service counts it (spec 008, R1).
  let id: unknown;
  let externalRef: unknown;
  try {
    if (isRecord(item)) {
      id = item.id;
      externalRef = item.externalRef;
    }
  } catch {
    return { event: undefined, warnings: [`${PREFIX} The item could not be read; no ${kind} event was recorded.`] };
  }
  const hasId = id !== undefined && id !== null;
  const hasRef = externalRef !== undefined && externalRef !== null;
  const occurredAt = new Date(now).toISOString();

  let event: EventRecord;
  if (hasId && hasRef) {
    return { event: undefined, warnings: [`${PREFIX} The item needs exactly one of id and externalRef, not both; no ${kind} event was recorded.`] };
  } else if (hasRef) {
    if (typeof externalRef !== "string" || !EXTERNAL_REF.test(externalRef)) {
      return { event: undefined, warnings: [`${PREFIX} externalRef must be 1 to 128 characters of A-Z, a-z, 0-9 and _ . : / -; no ${kind} event was recorded.`] };
    }
    event = { kind, external_ref: externalRef, occurred_at: occurredAt };
  } else {
    if (typeof id !== "string" || !UUID.test(id)) {
      return { event: undefined, warnings: [`${PREFIX} The item needs an id that is a UUID, as fetchPage returns it, or an externalRef; no ${kind} event was recorded.`] };
    }
    event = { kind, item_id: id, occurred_at: occurredAt };
  }

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
    if (isOpaqueText(actorRef, ACTOR_MAX)) event.actor_ref = actorRef;
    else warnings.push(`${PREFIX} actorRef must be 1 to ${ACTOR_MAX} characters of text; it was left out.`);
  }

  // The visit, as the platform names it (spec 005): sent as given, never made or kept here. null is none.
  if (sessionId !== undefined && sessionId !== null) {
    if (isOpaqueText(sessionId, SESSION_MAX)) event.session_id = sessionId;
    else warnings.push(`${PREFIX} sessionId must be 1 to ${SESSION_MAX} characters of text with no NUL; it was left out.`);
  }

  return { event, warnings };
}
