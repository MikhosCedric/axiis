import { describe, expect, it } from "vitest";
import { filteredArea, withDefaultArea } from "./capture-area";

const work = { id: "a1", name: "Work" };
const side = { id: "a2", name: "Side projects" };
const areas = [work, side];

describe("filteredArea", () => {
  it("is the area the address narrows to, or null", () => {
    expect(filteredArea("area=a1&tag=x", areas)).toBe(work);
    expect(filteredArea("area=gone", areas)).toBeNull();
    expect(filteredArea("tag=x", areas)).toBeNull();
    expect(filteredArea("area=a1", undefined)).toBeNull();
  });
});

describe("withDefaultArea", () => {
  it("adds the area to words that name none, and the capture reads it", () => {
    expect(withDefaultArea("call the bank", work, areas)).toBe("call the bank @Work");
    expect(withDefaultArea("plan trip tomorrow #fun", side, areas)).toBe("plan trip tomorrow #fun @Side projects");
  });

  it("leaves words that name an area, a missing filter or an empty line alone", () => {
    expect(withDefaultArea("call the bank @side projects", work, areas)).toBe("call the bank @side projects");
    expect(withDefaultArea("call the bank", null, areas)).toBe("call the bank");
    expect(withDefaultArea("  ", work, areas)).toBe("  ");
  });
});
