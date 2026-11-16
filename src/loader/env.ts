// What the loader needs from the page, as small structural types. No DOM library types,
// so tests pass plain objects and a stray DOM use elsewhere still fails to compile.

export interface ScriptLike {
  getAttribute(name: string): string | null;
}

export interface Env {
  document?: { currentScript?: ScriptLike | null };
  console?: { warn?: (text: string) => void };
  /** The page's stub; the loader creates it when the page has none. */
  contentSdk?: unknown;
}

export interface Settings {
  baseUrl: string;
  platformId: string;
}
