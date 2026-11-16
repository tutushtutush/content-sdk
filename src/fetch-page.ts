import { contractMismatch, fail, network, originNotAllowed, badQuery, succeed, unavailable, unknownPlacement } from "./errors";
import { buildRequestUrl } from "./request";
import { parsePage } from "./validate";
import type { DeliveryError, Options, Query, Result, Target } from "./types";

const MAX_SERVICE_MESSAGE = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** What the service said about an error, read leniently: nothing here decides the error kind. */
function readServiceError(text: string): { message?: string; fields?: string[] } {
  try {
    const body: unknown = JSON.parse(text);
    const error = isRecord(body) ? body.error : undefined;
    if (!isRecord(error)) return {};
    const out: { message?: string; fields?: string[] } = {};
    if (typeof error.message === "string") out.message = error.message.slice(0, MAX_SERVICE_MESSAGE);
    const details = error.details;
    if (isRecord(details) && Array.isArray(details.fields)) {
      const names: string[] = [];
      for (const f of details.fields) {
        if (isRecord(f) && typeof f.field === "string") names.push(f.field);
      }
      if (names.length > 0) out.fields = names;
    }
    return out;
  } catch {
    return {};
  }
}

async function errorFor(response: Response): Promise<DeliveryError> {
  const status = response.status;
  let seen: { message?: string; fields?: string[] } = {};
  try {
    seen = readServiceError(await response.text());
  } catch {
    // An unreadable error body does not change the kind.
  }
  if (status === 404) return unknownPlacement();
  if (status === 403) return originNotAllowed();
  if (status === 422) return badQuery({ status, fields: seen.fields, serviceMessage: seen.message });
  return unavailable(status, seen.message);
}

/**
 * Fetches one page of a placement. Always resolves: to the page, or to a typed error.
 * Pass `page.nextCursor` back as `query.cursor` for the next page.
 */
export async function fetchPage(target: Target, query?: Query, options?: Options): Promise<Result> {
  const built = buildRequestUrl(target, query);
  if ("error" in built) return fail(built.error);

  const opts: Options = isRecord(options) ? options : {};
  const signal = isRecord(opts.signal) ? opts.signal : undefined;
  const doFetch: typeof fetch | undefined =
    typeof opts.fetch === "function" ? opts.fetch : typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
  if (doFetch === undefined) return fail(network(new Error("fetch is not available")));

  let response: Response;
  try {
    response = await doFetch(built.url, { method: "GET", credentials: "omit", signal });
  } catch (cause) {
    return fail(network(cause, signal?.aborted === true));
  }
  if (!isRecord(response) || typeof response.status !== "number") {
    return fail(network(new Error("fetch did not return a response")));
  }

  if (response.status !== 200) return fail(await errorFor(response));

  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    return fail(network(cause, signal?.aborted === true));
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(contractMismatch(200, "the body is not JSON"));
  }
  const parsed = parsePage(body);
  if ("problem" in parsed) return fail(contractMismatch(200, parsed.problem));
  return succeed(parsed.page);
}
