import { isRecord } from "./guards";
import type { Image, Item, Page } from "./types";

export type Parsed = { page: Page } | { problem: string };

const WEB_ADDRESS = /^https?:\/\/\S+$/i;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseImage(value: unknown): Image | null {
  if (!isRecord(value)) return null;
  const url = value.url;
  if (typeof url !== "string" || !WEB_ADDRESS.test(url)) return null;
  return { url };
}

// A count is a whole number of 0 or more that a JSON number can carry exactly. Only `typeof` and
// `Number.isSafeInteger` touch the value (no string conversion), and `0` is a good count, so nothing here
// tests truthiness. `-0` is the number zero and is returned as 0.
function parseViewCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value === 0 ? 0 : value;
}

// Built field by field, so nothing the service adds (or names `__proto__`) reaches the result.
function parseItem(value: unknown): Item | string {
  if (!isRecord(value)) return "an item is not an object";
  const { id, platform, title, description, language, tags, images, created_at, url, view_count } = value;

  for (const [name, text] of Object.entries({ id, platform, title, description, language, created_at })) {
    if (typeof text !== "string") return `item ${name} is not text`;
  }
  if (!isStringArray(tags)) return "item tags is not a list of text";
  if (!Array.isArray(images)) return "item images is not a list";

  const parsedImages: Image[] = [];
  for (const raw of images) {
    const image = parseImage(raw);
    if (image === null) return "an item image has no http or https address";
    parsedImages.push(image);
  }

  if (url !== null && (typeof url !== "string" || !WEB_ADDRESS.test(url))) {
    return "item url is neither null nor an http or https address";
  }

  const viewCount = parseViewCount(view_count);
  if (viewCount === null) return "item view_count is not a whole number of 0 or more";

  return {
    id: id as string,
    platform: platform as string,
    title: title as string,
    description: description as string,
    language: language as string,
    tags: [...tags],
    images: parsedImages,
    created_at: created_at as string,
    url: url as string | null,
    view_count: viewCount,
  };
}

/** Checks a 200 body against the contract and returns the page, or what was wrong. */
export function parsePage(body: unknown): Parsed {
  if (!isRecord(body)) return { problem: "the answer is not an object" };
  const { items, next_cursor } = body;
  if (!Array.isArray(items)) return { problem: "items is not a list" };
  if (next_cursor !== null && typeof next_cursor !== "string") return { problem: "next_cursor is neither text nor null" };

  const parsed: Item[] = [];
  for (const raw of items) {
    const item = parseItem(raw);
    if (typeof item === "string") return { problem: item };
    parsed.push(item);
  }
  return { page: { items: parsed, nextCursor: next_cursor } };
}
