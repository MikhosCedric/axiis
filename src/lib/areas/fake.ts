import type { AreaColor } from "@/domain/area-color";
import type { Area, AreaId } from "@/domain/item";
import type { AreasRepo } from "./repo";

type Stored = Area & { deletedAt: Date | null };

/** An area to seed: its name, or its name and colour. */
export type SeedArea = string | { name: string; color: AreaColor | null };

/** In-memory AreasRepo for tests and dev harnesses. `rows` includes soft-deleted areas. Ids are stable per repo, so server and client renders agree. */
export function fakeAreasRepo(seed: SeedArea[] = []) {
  let seq = 0;
  const nextId = () => `00000000-0000-4000-a000-${String(++seq).padStart(12, "0")}` as AreaId;
  const rows: Stored[] = seed.map((area, i) => {
    const { name, color } = typeof area === "string" ? { name: area, color: null } : area;
    return { id: nextId(), name, position: i + 1, color, deletedAt: null };
  });
  const live = () => rows.filter((r) => r.deletedAt === null).sort((a, b) => a.position - b.position);
  const view = ({ id, name, position, color }: Stored): Area => ({ id, name, position, color });
  const find = (id: AreaId) => {
    const row = rows.find((r) => r.id === id && r.deletedAt === null);
    if (!row) throw new Error(`area ${id} not found`);
    return row;
  };

  const repo: AreasRepo = {
    async list() {
      return live().map(view);
    },
    async create(name) {
      const row: Stored = { id: nextId(), name, position: (live().at(-1)?.position ?? 0) + 1, color: null, deletedAt: null };
      rows.push(row);
      return view(row);
    },
    async rename(id, name) {
      const row = find(id);
      row.name = name;
      return view(row);
    },
    async setColor(id, color) {
      const row = find(id);
      row.color = color;
      return view(row);
    },
    async softDelete(id) {
      const row = rows.find((r) => r.id === id && r.deletedAt === null);
      if (row) row.deletedAt = new Date();
    },
    async reorder(ids) {
      ids.forEach((id, index) => {
        find(id).position = index + 1;
      });
    },
  };
  return { repo, rows };
}
