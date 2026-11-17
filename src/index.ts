import { createLibrary } from "./events/library";

export { fetchPage } from "./fetch-page";
export type { Target, Query, Options, Result, Page, Item, Image, DeliveryError, ErrorKind, ReportTarget, ViewOptions } from "./types";

const library = createLibrary(globalThis as never);

/** Reports one `view` of the item when the element has been seen on screen (at least half visible for a second); returns `stop`. */
export const watchView = library.watchView;
/** Reports one `link_click` of the item. */
export const trackLinkClick = library.trackLinkClick;
