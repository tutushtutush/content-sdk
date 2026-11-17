/** How long waiting events wait, counted from the first one queued. */
export const FLUSH_DELAY_MS = 2000;
/** The most events one request holds: the service's own batch limit. */
export const BATCH_MAX = 50;
/** How long an element must stay half visible, without a break, to count as seen. */
export const DWELL_MS = 1000;
/** The share of the element's area that must be visible. */
export const VISIBLE_RATIO = 0.5;
/** A watch that has not reported this long after it began gives up and lets go of its element. */
export const GIVE_UP_MS = 120_000;
