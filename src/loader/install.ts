import { fetchPage } from "../fetch-page";
import { makeFetchPage, makeRunner } from "./commands";
import type { Env } from "./env";
import { readSettings } from "./settings";
import { clip, warn } from "./warn";

interface Sdk {
  q: unknown[];
  fetchPage?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Installs the loader into the page. Never throws: a failure is one console warning. */
export function install(env: Env): void {
  try {
    start(env);
  } catch (cause) {
    // A last guard; the steps below are written not to throw.
    warn(env, `[content-sdk] The loader failed to start: ${clip(cause instanceof Error ? cause.message : cause, 200)}`);
  }
}

/** Reads the tag, offers `contentSdk.fetchPage`, replays the queue. */
function start(env: Env): void {
  // document.currentScript names the running script only during this first synchronous run.
  const script = env.document?.currentScript;
  const read = readSettings(script);
  if ("missing" in read) {
    // Nothing is created, replayed or changed on the page.
    warn(env, `[content-sdk] Missing ${read.missing.join(" and ")} on the content-sdk <script> tag. Nothing will be fetched.`);
    return;
  }

  if (isObject(env.contentSdk) && typeof env.contentSdk.fetchPage === "function") {
    warn(env, "[content-sdk] The script was loaded twice; the second load was ignored.");
    return;
  }

  const sdk = (isObject(env.contentSdk) ? env.contentSdk : (env.contentSdk = { q: [] })) as unknown as Sdk;
  if (!Array.isArray(sdk.q)) sdk.q = [];
  const queue = sdk.q;

  const method = makeFetchPage(read.settings, { fetchPage, env });
  sdk.fetchPage = method;
  const run = makeRunner({ fetchPage: method }, env);

  // Replay in order; an index loop also picks up entries pushed while it runs.
  for (let i = 0; i < queue.length; i++) run(queue[i]);
  queue.length = 0;

  // From now on a push runs at once and is not kept.
  queue.push = (...entries: unknown[]) => {
    for (const entry of entries) run(entry);
    return queue.length;
  };
}
