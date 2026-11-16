import type { ScriptLike, Settings } from "./env";

export const BASE_URL_ATTRIBUTE = "data-api-base-url";
export const PLATFORM_ID_ATTRIBUTE = "data-platform-id";

export type ReadSettings = { settings: Settings } | { missing: string[] };

function attribute(script: ScriptLike, name: string): string {
  try {
    const value = script.getAttribute(name);
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

/** Reads the two attributes from the loader's own script tag, or says which are missing or blank. */
export function readSettings(script: ScriptLike | null | undefined): ReadSettings {
  const baseUrl = script ? attribute(script, BASE_URL_ATTRIBUTE) : "";
  const platformId = script ? attribute(script, PLATFORM_ID_ATTRIBUTE) : "";
  const missing: string[] = [];
  if (baseUrl === "") missing.push(BASE_URL_ATTRIBUTE);
  if (platformId === "") missing.push(PLATFORM_ID_ATTRIBUTE);
  return missing.length > 0 ? { missing } : { settings: { baseUrl, platformId } };
}
