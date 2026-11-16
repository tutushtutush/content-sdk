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
