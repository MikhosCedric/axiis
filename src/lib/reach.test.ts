import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reach, UNREACHABLE } from "./reach";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function clientFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "dev" ? [] : clientFiles(path);
    return path.endsWith(".tsx") && readFileSync(path, "utf8").startsWith('"use client"') ? [path] : [];
  });
}

describe("every save in a transition goes through reach", () => {
  it("leaves no bare await inside an async transition in a client component", () => {
    const bare = clientFiles(SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      const bodies = [...text.matchAll(/start\w*\(async \(\) => \{([\s\S]*?)\n\s*\}\);/g)].map((m) => m[1]);
      return bodies.flatMap((body) =>
        [...body.matchAll(/await (?!reach\()[^;\n]*/g)].map((m) => `${relative(SRC, file)}: ${m[0]}`),
      );
    });
    expect(bare).toEqual([]);
  });
});

describe("reach", () => {
  it("passes an action's own answer through, refusals included", async () => {
    expect(await reach(Promise.resolve({ ok: true, id: "a" }))).toEqual({ ok: true, id: "a" });
    expect(await reach(Promise.resolve({ ok: false, error: "That area is not here any more." }))).toEqual({
      ok: false,
      error: "That area is not here any more.",
    });
  });

  it("turns a call that never reached the server into a refusal instead of a thrown error", async () => {
    expect(await reach(Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: UNREACHABLE });
  });
});
