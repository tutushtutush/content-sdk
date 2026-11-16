import type { Env } from "./env";

/** Text of any value, cut to `max` characters; never throws. */
export function clip(value: unknown, max: number): string {
  try {
    return String(value).slice(0, max);
  } catch {
    return "";
  }
}

/** One console warning. Never throws, never logs anything but the text it is given. */
export function warn(env: Env, text: string): void {
  try {
    env.console?.warn?.(text);
  } catch {
    // A broken console must not break the page.
  }
}
