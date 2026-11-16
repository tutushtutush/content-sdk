import type { Env } from "../../../src/loader/env";

export function fakeEnv(attrs: Record<string, string> | null, contentSdk?: unknown) {
  const warnings: string[] = [];
  const env: Env & { contentSdk?: unknown } = {
    document: { currentScript: attrs === null ? null : { getAttribute: (n: string) => (n in attrs ? attrs[n] : null) } },
    console: { warn: (t: string) => warnings.push(t) },
  };
  if (contentSdk !== undefined) env.contentSdk = contentSdk;
  return { env, warnings };
}

export const GOOD = { "data-api-base-url": "https://api.example.com", "data-platform-id": "listings" };
