import { describe, expect, it } from "vitest";
import { moved, planOrder, type OrderEnd, type Placed } from "./order";

const rows = (...positions: number[]): Placed[] => positions.map((position, i) => ({ id: String.fromCharCode(97 + i), position }));

/** The rows after the plan's writes, sorted as the database would: by position, ties in the order given. */
function after(wanted: Placed[], end: OrderEnd, tieOrder: string[] = wanted.map((r) => r.id)) {
  const writes = new Map(planOrder(wanted, end).map((w) => [w.id, w.position]));
  return wanted
    .map((r) => ({ id: r.id, position: writes.get(r.id) ?? r.position }))
    .sort((x, y) => x.position - y.position || tieOrder.indexOf(x.id) - tieOrder.indexOf(y.id))
    .map((r) => r.id);
}

describe("planOrder", () => {
  it("numbers lines that were never moved below zero, so a line added later comes last", () => {
    expect(planOrder(rows(0, 0, 0), "new-last")).toEqual([
      { id: "a", position: -3 },
      { id: "b", position: -2 },
      { id: "c", position: -1 },
    ]);
  });

  it("numbers checklists that were never moved above zero, so a new one comes first", () => {
    expect(planOrder(rows(0, 0, 0), "new-first")).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ]);
  });

  it("writes nothing when the order is already stored", () => {
    expect(planOrder(rows(-3, -2, -1), "new-last")).toEqual([]);
    expect(planOrder(rows(1, 2.5, 3), "new-first")).toEqual([]);
    expect(planOrder(rows(0), "new-last")).toEqual([]);
  });

  it("moves one row with one write, halfway between its new neighbours", () => {
    // c of a(-3) b(-2) c(-1) moved up one.
    expect(planOrder([{ id: "a", position: -3 }, { id: "c", position: -1 }, { id: "b", position: -2 }], "new-last")).toEqual([
      { id: "c", position: -2.5 },
    ]);
  });

  it("keeps a line moved to the end below zero, and a checklist moved to the top above it", () => {
    expect(planOrder([{ id: "b", position: -2 }, { id: "c", position: -1 }, { id: "a", position: -3 }], "new-last")).toEqual([
      { id: "a", position: -0.5 },
    ]);
    expect(planOrder([{ id: "c", position: 3 }, { id: "a", position: 1 }, { id: "b", position: 2 }], "new-first")).toEqual([
      { id: "c", position: 0.5 },
    ]);
  });

  it("gives a row moved to the open end a whole step of room", () => {
    expect(planOrder([{ id: "c", position: -1 }, { id: "a", position: -3 }, { id: "b", position: -2 }], "new-last")).toEqual([
      { id: "c", position: -4 },
    ]);
    expect(planOrder([{ id: "b", position: 2 }, { id: "c", position: 3 }, { id: "a", position: 1 }], "new-first")).toEqual([
      { id: "a", position: 4 },
    ]);
  });

  it("places a line added since the last move with one write too", () => {
    // d was added (0) after a, b, c were ordered; d is now moved above c.
    const wanted = [{ id: "a", position: -3 }, { id: "b", position: -2 }, { id: "d", position: 0 }, { id: "c", position: -1 }];
    expect(planOrder(wanted, "new-last")).toEqual([{ id: "d", position: -1.5 }]);
  });

  it("numbers again when more than one row is out of place, writing only what changes", () => {
    // d and e were both added (0) since; d is moved up between a and b, and e still ties with it.
    const wanted = [{ id: "a", position: -2 }, { id: "d", position: 0 }, { id: "e", position: 0 }, { id: "b", position: -1 }];
    expect(planOrder(wanted, "new-last")).toEqual([
      { id: "a", position: -4 },
      { id: "d", position: -3 },
      { id: "e", position: -2 },
    ]);
  });

  it("numbers again when two neighbours have no room left between them", () => {
    const tight = [{ id: "a", position: 1 }, { id: "c", position: 0 }, { id: "b", position: 1 + Number.EPSILON }];
    expect(planOrder(tight, "new-first")).toEqual([
      { id: "c", position: 2 },
      { id: "b", position: 3 },
    ]);
  });

  it.each(["new-last", "new-first"] as const)("%s: any move of any list ends up sorted as wanted", (end) => {
    const sign = end === "new-last" ? -1 : 1;
    const lists = [rows(0, 0, 0, 0), rows(1, 2, 3, 4).map((r) => ({ ...r, position: sign * (end === "new-last" ? 5 - r.position : r.position) })), rows(0, 0)];
    for (const list of lists) {
      for (let from = 0; from < list.length; from++) {
        for (let to = 0; to < list.length; to++) {
          const wanted = moved(list, from, to);
          expect(after(wanted, end)).toEqual(wanted.map((r) => r.id));
        }
      }
    }
  });
});

describe("moved", () => {
  it("moves one entry and keeps the rest in order", () => {
    expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moved(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("gives the same order back for a move that goes nowhere", () => {
    expect(moved(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(moved(["a", "b"], 0, 2)).toEqual(["a", "b"]);
    expect(moved(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});
