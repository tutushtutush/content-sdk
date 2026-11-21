import { createLibrary } from "../../../src/events/library";
import type { Item } from "../../../src/types";

// Spec 008, FR-009: the item parameter is "has an id" or "has an externalRef". `npm run typecheck` is what proves the
// expect-error comments (an unused one is an error); the function below is never called.
const library = createLibrary({} as never);
const target = { baseUrl: "https://api.example.com", platformId: "listings" };

export function compileOnly(fetched: Item): void {
  library.trackLinkClick(target, { id: "2f8b6c1e-3b0d-4d8a-9a9e-5a4f1b7c2d10" });
  library.trackLinkClick(target, { externalRef: "telegram:addis_news/10234" });
  library.trackLinkClick(target, fetched);
  library.watchView(target, {}, fetched);
  library.watchView(target, {}, { externalRef: "x" }, { placementId: "telegram" });
  // @ts-expect-error neither an id nor an externalRef
  library.trackLinkClick(target, {});
  // @ts-expect-error both
  library.trackLinkClick(target, { id: "a", externalRef: "b" });
  // @ts-expect-error externalRef is text
  library.trackLinkClick(target, { externalRef: 5 });
  // @ts-expect-error neither, for a view
  library.watchView(target, {}, { title: "Bike" });
}

describe("the types of the reporting calls", () => {
  it("accept both shapes (the refusals are proved by the type check)", () => {
    expect(typeof compileOnly).toBe("function");
  });
});
