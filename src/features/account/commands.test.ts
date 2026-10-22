import { describe, expect, it } from "vitest";
import type { AreaId } from "@/domain/item";
import { fakeAreasRepo } from "@/lib/areas/fake";
import {
  AREA_LIMIT,
  addArea,
  deleteAccount,
  moveArea,
  moved,
  removeArea,
  renameArea,
  setAreaColor,
  type AccountPort,
} from "./commands";

const BAD_IDS = ["", "1; drop table areas", null, 42, { id: "x" }];
const names = async (repo: ReturnType<typeof fakeAreasRepo>["repo"]) => (await repo.list()).map((a) => a.name);

describe("addArea", () => {
  it("trims the name and appends it after the last area", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    expect(await addArea(repo, "  Garden  ")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Work", "Home", "Garden"]);
  });

  it("refuses a name that is not 1 to 40 characters", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    for (const name of ["", "   ", "x".repeat(41), null, 7, ["Work"]]) {
      expect(await addArea(repo, name)).toEqual({ ok: false, error: "An area name needs 1 to 40 characters." });
    }
    expect(await names(repo)).toEqual(["Work"]);
  });

  it("accepts exactly 40 characters", async () => {
    const { repo } = fakeAreasRepo();
    expect(await addArea(repo, "x".repeat(40))).toEqual({ ok: true });
  });

  it("refuses a name another live area already has, whatever the case", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    expect(await addArea(repo, " WORK ")).toEqual({ ok: false, error: "You already have an area called Work." });
    expect(await names(repo)).toEqual(["Work"]);
  });

  it("allows the name of a deleted area", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    await removeArea(repo, (await repo.list())[0].id);
    expect(await addArea(repo, "Work")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Work"]);
  });

  it(`stops at ${AREA_LIMIT} live areas, and counts only live ones`, async () => {
    const { repo } = fakeAreasRepo(Array.from({ length: AREA_LIMIT }, (_, i) => `Area ${i}`));
    expect(await addArea(repo, "One more")).toEqual({
      ok: false,
      error: "Axiis keeps up to 12 areas. Remove one to make room.",
    });
    await removeArea(repo, (await repo.list())[0].id);
    expect(await addArea(repo, "One more")).toEqual({ ok: true });
    expect(await repo.list()).toHaveLength(AREA_LIMIT);
  });

  it("reports a failed save instead of throwing", async () => {
    const { repo } = fakeAreasRepo();
    repo.create = async () => {
      throw new Error("network");
    };
    expect(await addArea(repo, "Work")).toEqual({ ok: false, error: "That change did not save. Try again." });
  });
});

describe("renameArea", () => {
  it("trims and saves the new name", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    const [work] = await repo.list();
    expect(await renameArea(repo, work.id, " Job ")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Job", "Home"]);
  });

  it("lets an area change the case of its own name", async () => {
    const { repo } = fakeAreasRepo(["work"]);
    const [work] = await repo.list();
    expect(await renameArea(repo, work.id, "Work")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Work"]);
  });

  it("refuses a name another live area has", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    const [work] = await repo.list();
    expect(await renameArea(repo, work.id, "home")).toEqual({ ok: false, error: "You already have an area called Home." });
    expect(await names(repo)).toEqual(["Work", "Home"]);
  });

  it("refuses a bad name or id without writing", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    const [work] = await repo.list();
    expect(await renameArea(repo, work.id, "  ")).toEqual({ ok: false, error: "An area name needs 1 to 40 characters." });
    for (const id of BAD_IDS) {
      expect(await renameArea(repo, id, "Job")).toEqual({ ok: false, error: "That area is not here any more." });
    }
    expect(await names(repo)).toEqual(["Work"]);
  });

  it("says plainly when the area is gone", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    const [work] = await repo.list();
    await removeArea(repo, work.id);
    expect(await renameArea(repo, work.id, "Job")).toEqual({ ok: false, error: "That area is not here any more." });
  });
});

describe("setAreaColor", () => {
  const colors = async (repo: ReturnType<typeof fakeAreasRepo>["repo"]) => (await repo.list()).map((a) => a.color);

  it("sets a palette colour on one area and clears it with null", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    const [work] = await repo.list();
    expect(await setAreaColor(repo, work.id, "moss")).toEqual({ ok: true });
    expect(await colors(repo)).toEqual(["moss", null]);
    expect(await setAreaColor(repo, work.id, null)).toEqual({ ok: true });
    expect(await colors(repo)).toEqual([null, null]);
  });

  it.each(["red", "Moss", "", "verdigris", "#964b2c", undefined, 3, { color: "moss" }])("refuses %j", async (color) => {
    const { repo } = fakeAreasRepo([{ name: "Work", color: "clay" }]);
    const [work] = await repo.list();
    expect(await setAreaColor(repo, work.id, color)).toEqual({ ok: false, error: "That colour is not one Axiis offers." });
    expect(await colors(repo)).toEqual(["clay"]);
  });

  it("refuses an id that is not a live area", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    const [work] = await repo.list();
    await removeArea(repo, work.id);
    for (const id of [...BAD_IDS, work.id]) {
      expect(await setAreaColor(repo, id, "plum")).toEqual({ ok: false, error: "That area is not here any more." });
    }
  });

  it("keeps the colour through a rename and a move", async () => {
    const { repo } = fakeAreasRepo(["Work", { name: "Home", color: "ochre" }]);
    const home = (await repo.list())[1];
    await renameArea(repo, home.id, "House");
    await moveArea(repo, home.id, "up");
    expect((await repo.list())[0]).toMatchObject({ name: "House", color: "ochre" });
  });
});

describe("removeArea", () => {
  it("soft-deletes the area so its row stays for the items that point at it", async () => {
    const { repo, rows } = fakeAreasRepo(["Work", "Home"]);
    const [work] = await repo.list();
    expect(await removeArea(repo, work.id)).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Home"]);
    expect(rows.find((r) => r.id === work.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it("refuses a malformed id", async () => {
    const { repo } = fakeAreasRepo(["Work"]);
    for (const id of BAD_IDS) expect(await removeArea(repo, id)).toEqual({ ok: false, error: "That area is not here any more." });
    expect(await names(repo)).toEqual(["Work"]);
  });
});

describe("moved", () => {
  const [a, b, c] = ["a", "b", "c"] as AreaId[];
  it("swaps with the neighbour in that direction", () => {
    expect(moved([a, b, c], b, "up")).toEqual([b, a, c]);
    expect(moved([a, b, c], b, "down")).toEqual([a, c, b]);
  });
  it("returns null at either end or for an unknown id", () => {
    expect(moved([a, b, c], a, "up")).toBeNull();
    expect(moved([a, b, c], c, "down")).toBeNull();
    expect(moved([a, b], c, "up")).toBeNull();
  });
});

describe("moveArea", () => {
  it("moves an area one place and renumbers the whole list", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home", "Health"]);
    const [, home] = await repo.list();
    expect(await moveArea(repo, home.id, "up")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Home", "Work", "Health"]);
    expect((await repo.list()).map((a) => a.position)).toEqual([1, 2, 3]);
    expect(await moveArea(repo, home.id, "down")).toEqual({ ok: true });
    expect(await names(repo)).toEqual(["Work", "Home", "Health"]);
  });

  it("does nothing at the ends", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    let writes = 0;
    const reorder = repo.reorder;
    repo.reorder = async (ids) => {
      writes += 1;
      return reorder(ids);
    };
    const [work, home] = await repo.list();
    expect(await moveArea(repo, work.id, "up")).toEqual({ ok: true });
    expect(await moveArea(repo, home.id, "down")).toEqual({ ok: true });
    expect(writes).toBe(0);
  });

  it("refuses an unknown direction, a bad id, or an area that is gone", async () => {
    const { repo } = fakeAreasRepo(["Work", "Home"]);
    const [work, home] = await repo.list();
    await removeArea(repo, home.id);
    const missing = { ok: false, error: "That area is not here any more." };
    expect(await moveArea(repo, work.id, "sideways")).toEqual(missing);
    expect(await moveArea(repo, home.id, "up")).toEqual(missing);
    for (const id of BAD_IDS) expect(await moveArea(repo, id, "up")).toEqual(missing);
  });
});

describe("deleteAccount", () => {
  function port(fail?: "delete" | "signOut") {
    const calls: string[] = [];
    const p: AccountPort = {
      async deleteMyAccount() {
        calls.push("delete");
        if (fail === "delete") throw new Error("rpc failed");
      },
      async signOut() {
        calls.push("signOut");
        if (fail === "signOut") throw new Error("already gone");
      },
    };
    return { p, calls };
  }

  it("deletes, then signs out, when the phrase is typed exactly", async () => {
    const { p, calls } = port();
    expect(await deleteAccount(p, "delete my account")).toEqual({ ok: true });
    expect(calls).toEqual(["delete", "signOut"]);
  });

  it("forgives surrounding spaces", async () => {
    const { p, calls } = port();
    expect(await deleteAccount(p, "  delete my account ")).toEqual({ ok: true });
    expect(calls).toEqual(["delete", "signOut"]);
  });

  it.each(["", "delete", "Delete my account", "DELETE MY ACCOUNT", "delete  my account", "delete my account.", null, 1])(
    "touches nothing for %j",
    async (phrase) => {
      const { p, calls } = port();
      expect(await deleteAccount(p, phrase)).toEqual({ ok: false, error: "Type delete my account to confirm." });
      expect(calls).toEqual([]);
    },
  );

  it("does not sign out, and says nothing changed, when the delete fails", async () => {
    const { p, calls } = port("delete");
    expect(await deleteAccount(p, "delete my account")).toEqual({
      ok: false,
      error: "Your account was not deleted, and nothing has changed. Try again in a moment.",
    });
    expect(calls).toEqual(["delete"]);
  });

  it("still succeeds when signing out fails after the account is gone", async () => {
    const { p, calls } = port("signOut");
    expect(await deleteAccount(p, "delete my account")).toEqual({ ok: true });
    expect(calls).toEqual(["delete", "signOut"]);
  });
});
