/** A non-null object that is not an array: what a parsed JSON object or an options bag looks like. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
