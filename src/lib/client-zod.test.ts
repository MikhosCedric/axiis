import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Classic zod carries every locale table into whatever chunk imports it (about 64 KB gzipped).
// Modules a client component can reach use zod/mini or plain checks; server modules keep classic zod.
const SRC = resolve(__dirname, "..");
const DEV_HARNESSES = join(SRC, "app", "dev");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const directive = (text: string, name: string) => new RegExp(`^\\s*["']${name}["']`).test(text);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function valueImports(text: string): string[] {
  const specs: string[] = [];
  for (const match of text.matchAll(/^\s*(import|export)\s+(type\s+)?[^"';]*?from\s+["']([^"']+)["']/gm)) {
    if (!match[2]) specs.push(match[3]);
  }
  for (const match of text.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(match[1]);
  return specs;
}

function classicZodReachableFrom(entries: string[]): string[] {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    // A server action module reaches the client as a reference, not as code.
    if (directive(text, "use server")) continue;
    const specs = valueImports(text);
    if (specs.includes("zod")) offenders.push(relative(SRC, file).replaceAll("\\", "/"));
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next) queue.push(next);
    }
  }
  return offenders.sort();
}

describe("client bundle", () => {
  const files = sources(SRC).filter((f) => !f.startsWith(DEV_HARNESSES));
  const clientEntries = files.filter((f) => directive(readFileSync(f, "utf8"), "use client"));

  it("finds the client components it guards", () => {
    expect(clientEntries.length).toBeGreaterThan(20);
  });

  it("reaches no module that imports classic zod", () => {
    expect(classicZodReachableFrom(clientEntries)).toEqual([]);
  });

  it("would catch a client-reachable classic zod import", () => {
    expect(classicZodReachableFrom([join(SRC, "features", "today", "commands.ts")])).toContain("features/today/commands.ts");
  });
});
