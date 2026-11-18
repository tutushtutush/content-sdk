/** Where to read from: the service's base address and the two ids a platform was given. */
export interface Target {
  baseUrl: string;
  platformId: string;
  placementId: string;
}

/** Optional narrowing of one fetch. Only values that are given are sent. */
export interface Query {
  /** Whole number 1 to 50. */
  limit?: number;
  tags?: string[];
  languages?: string[];
  /** A `nextCursor` of an earlier page of the same placement and filters; passed through unchanged. */
  cursor?: string;
  /**
   * Words to search for. Text of at most 100 characters after trimming (characters, not bytes); empty or
   * only spaces means no search. The service decides matching and order, so pass the same `q` with a
   * `cursor`: a cursor belongs to the search it came from.
   */
  q?: string;
  /**
   * The order of the page: `popular`, `newest` or `oldest`, in lower case; anything else (an empty text
   * included) is a `bad_query` error naming `sort`, with no request. Without it the service keeps its own
   * order (newest first, best match first with `q`) and the SDK adds none. A cursor belongs to the order and
   * the `q` that made it, so pass the same ones with it. With `q` and a `sort` only the matches come back,
   * in that order. A `popular` list is ranked as of its first page, and a change in an item's view count
   * between two pages can repeat or skip an item.
   */
  sort?: "popular" | "newest" | "oldest";
}

export interface Options {
  /** Performs the request. Defaults to the environment's `fetch`. */
  fetch?: typeof fetch;
  /** Cancels the request. Build timeouts with `AbortSignal.timeout(ms)`. */
  signal?: AbortSignal;
}

export interface Image {
  url: string;
}

/** One item as the service delivers it. All text is untrusted. */
export interface Item {
  id: string;
  platform: string;
  title: string;
  description: string;
  language: string;
  tags: string[];
  images: Image[];
  created_at: string;
  url: string | null;
  /**
   * How many times the service has stored a view of this item, from every platform that reported one (not
   * only yours): a whole number of 0 or more, `0` when none. It is raw: a visitor who refreshes ten times can
   * add ten, so it is not a count of people and not for billing, and the service may make the rule stricter
   * later. The SDK passes it on as the service sent it and never formats or sums it. A page whose item has
   * no valid `view_count` is refused as `contract_mismatch`.
   */
  view_count: number;
}

export interface Page {
  items: Item[];
  nextCursor: string | null;
}

export type ErrorKind =
  | "unknown_placement"
  | "origin_not_allowed"
  | "bad_query"
  | "unavailable"
  | "network"
  | "contract_mismatch"
  | "invalid_target";

export interface DeliveryError {
  kind: ErrorKind;
  /** Written by the SDK, never taken from the service. */
  message: string;
  status?: number;
  fields?: string[];
  /** Set on a `network` error when the caller's signal cancelled the request. */
  aborted?: true;
  /** The service's own error text, plain, for debugging only. */
  serviceMessage?: string;
  cause?: unknown;
}

export type Result = { ok: true; page: Page } | { ok: false; error: DeliveryError };

/** Where events go: the service's base address and the platform id. A fetch target is accepted too. */
export interface ReportTarget {
  baseUrl: string;
  platformId: string;
}

/** Optional facts about one reported view or click. Each is sent as given when it is valid. */
export interface ViewOptions {
  /** The placement the item was read through: 3 to 40 characters of a-z, 0-9 and -. */
  placementId?: string;
  /** Opaque text naming who or what saw it, 1 to 128 characters. The SDK makes none and stores none. */
  actorRef?: string;
  /** The visit the event belongs to, chosen by the platform: 1 to 128 characters of text with no NUL. The SDK makes none and stores none. */
  sessionId?: string;
}
