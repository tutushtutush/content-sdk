// What the reporter needs from the page, as small structural types. No DOM library types,
// so tests pass plain objects and a stray DOM use elsewhere still fails to compile.

export interface ObserverEntryLike {
  isIntersecting: boolean;
  intersectionRatio: number;
}

export interface ObserverLike {
  observe(element: unknown): void;
  disconnect(): void;
}

export type ObserverConstructor = new (
  callback: (entries: ObserverEntryLike[]) => void,
  options: { threshold: number | number[] },
) => ObserverLike;

export interface FetchInit {
  method: "POST";
  body: string;
  keepalive: true;
  credentials: "omit";
  headers: { "content-type": string };
}

/** Everything the reporter touches, so a test can hand it fakes. */
export interface ReportEnv {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  IntersectionObserver?: ObserverConstructor;
  /** Queues the body for sending after the page is gone; false means the browser refused it. */
  sendBeacon?: (url: string, body: string) => boolean;
  fetch?: (url: string, init: FetchInit) => unknown;
  /** Calls the listener whenever the page is hidden or being left. Called once, when the first event is queued. */
  onPageHidden?: (listener: () => void) => void;
  /** One console warning; never throws. */
  warn(text: string): void;
}
