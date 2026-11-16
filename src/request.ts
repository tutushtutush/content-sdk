import { badQuery, invalidTarget } from "./errors";
import { isRecord } from "./guards";
import type { DeliveryError, Query, Target } from "./types";

const MAX_LIST_VALUES = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const MAX_CURSOR = 512;
const TAG = /^[a-z0-9_:-]{1,64}$/;

export type Built = { url: string } | { error: DeliveryError };

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// "." and ".." would be folded into the path by the URL parser, even when encoded.
function usableId(value: unknown): value is string {
  return nonEmptyText(value) && value !== "." && value !== "..";
}

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function checkList(
  values: unknown,
  param: string,
  accept: (v: string) => boolean,
): { value?: string } | { error: DeliveryError } {
  if (values === undefined) return {};
  const problem = { error: badQuery({ fields: [param] }) };
  if (!Array.isArray(values) || values.length > MAX_LIST_VALUES) return problem;
  for (const v of values) {
    if (typeof v !== "string" || !accept(v)) return problem;
  }
  return values.length === 0 ? {} : { value: values.join(",") };
}

/** Checks the target and query and builds the request address, or says what is wrong. */
export function buildRequestUrl(target: Target, query?: Query): Built {
  if (!isRecord(target)) return { error: invalidTarget("target") };

  let base: URL;
  try {
    if (!nonEmptyText(target.baseUrl)) throw new Error("not text");
    base = new URL(target.baseUrl);
  } catch {
    return { error: invalidTarget("baseUrl") };
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return { error: invalidTarget("baseUrl") };
  // A query or fragment would be dropped silently; say so instead.
  if (base.search !== "" || base.hash !== "") return { error: invalidTarget("baseUrl") };
  if (!usableId(target.platformId)) return { error: invalidTarget("platformId") };
  if (!usableId(target.placementId)) return { error: invalidTarget("placementId") };

  if (query !== undefined && !isRecord(query)) return { error: badQuery() };
  const q: Query = query ?? {};
  const params = new URLSearchParams();

  if (q.limit !== undefined) {
    if (typeof q.limit !== "number" || !Number.isInteger(q.limit) || q.limit < MIN_LIMIT || q.limit > MAX_LIMIT) {
      return { error: badQuery({ fields: ["limit"] }) };
    }
    params.set("limit", String(q.limit));
  }

  const tags = checkList(q.tags, "tag", (v) => TAG.test(v));
  if ("error" in tags) return tags;
  if (tags.value !== undefined) params.set("tag", tags.value);

  const languages = checkList(q.languages, "language", (v) => v.length >= 1 && v.length <= 16 && !v.includes(","));
  if ("error" in languages) return languages;
  if (languages.value !== undefined) params.set("language", languages.value);

  if (q.cursor !== undefined) {
    if (typeof q.cursor !== "string" || q.cursor.length > MAX_CURSOR) return { error: badQuery({ fields: ["cursor"] }) };
    if (q.cursor.length > 0) params.set("cursor", q.cursor);
  }

  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(
    `${base.origin}${prefix}/api/v1/delivery/${encodeId(target.platformId)}/${encodeId(target.placementId)}`,
  );
  const search = params.toString();
  return { url: search === "" ? url.href : `${url.href}?${search}` };
}
