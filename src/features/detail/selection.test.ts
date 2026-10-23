import { describe, expect, it } from "vitest";
import { selectionStep, withItem } from "./selection";

describe("selectionStep", () => {
  it("adds a history entry when the panel opens", () => {
    expect(selectionStep({ from: null, to: "a", here: "/inbox", opened: null })).toBe("push");
  });

  it("replaces the entry when another item is picked with the panel open", () => {
    expect(selectionStep({ from: "a", to: "b", here: "/inbox?item=a", opened: "/inbox?item=a" })).toBe("replace");
  });

  it("goes back over the entry it added when the panel closes", () => {
    expect(selectionStep({ from: "a", to: null, here: "/inbox?item=a", opened: "/inbox?item=a" })).toBe("back");
  });

  it("replaces on close when the entry came from a link or a reload", () => {
    expect(selectionStep({ from: "a", to: null, here: "/inbox?item=a", opened: null })).toBe("replace");
    expect(selectionStep({ from: "a", to: null, here: "/inbox?item=a", opened: "/week?item=a" })).toBe("replace");
  });

  it("does nothing when the selection would not change", () => {
    expect(selectionStep({ from: null, to: null, here: "/inbox", opened: null })).toBe("none");
    expect(selectionStep({ from: "a", to: "a", here: "/inbox?item=a", opened: null })).toBe("none");
  });
});

describe("withItem", () => {
  it("sets, replaces and drops the item while keeping other params in place", () => {
    expect(withItem("/today", "view=list", "item", "a")).toBe("/today?view=list&item=a");
    expect(withItem("/today", "item=a&view=list", "item", "b")).toBe("/today?item=b&view=list");
    expect(withItem("/today", "item=a&view=list", "item", null)).toBe("/today?view=list");
    expect(withItem("/today", "item=a", "item", null)).toBe("/today");
  });
});
