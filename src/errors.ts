import type { DeliveryError, Page, Result } from "./types";

export function succeed(page: Page): Result {
  return { ok: true, page };
}

export function fail(error: DeliveryError): Result {
  return { ok: false, error };
}

export function unknownPlacement(): DeliveryError {
  return { kind: "unknown_placement", message: "The platform or placement does not exist or is switched off", status: 404 };
}

export function originNotAllowed(): DeliveryError {
  return { kind: "origin_not_allowed", message: "This page's origin is not allowed for the platform", status: 403 };
}

export function badQuery(extra: { fields?: string[]; status?: number; serviceMessage?: string } = {}): DeliveryError {
  const error: DeliveryError = { kind: "bad_query", message: "The query was refused" };
  if (extra.status !== undefined) error.status = extra.status;
  if (extra.fields !== undefined) error.fields = extra.fields;
  if (extra.serviceMessage !== undefined) error.serviceMessage = extra.serviceMessage;
  return error;
}

export function unavailable(status: number, serviceMessage?: string): DeliveryError {
  const error: DeliveryError = { kind: "unavailable", message: "The service could not answer", status };
  if (serviceMessage !== undefined) error.serviceMessage = serviceMessage;
  return error;
}

export function network(cause: unknown, aborted = false): DeliveryError {
  const error: DeliveryError = {
    kind: "network",
    message: aborted ? "The request was cancelled" : "The request failed before an answer was read",
    cause,
  };
  if (aborted) error.aborted = true;
  return error;
}

export function contractMismatch(status: number, problem: string): DeliveryError {
  return { kind: "contract_mismatch", message: `The answer does not match the contract: ${problem}`, status };
}

export function invalidTarget(field: string): DeliveryError {
  return { kind: "invalid_target", message: `The ${field} is not usable`, fields: [field] };
}
