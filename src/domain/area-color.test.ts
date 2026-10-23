import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREA_COLORS, areaColorLabel, isAreaColor } from "./area-color";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const migration = readFileSync(join(__dirname, "../../supabase/migrations/0011_colors.sql"), "utf8");

type Rgb = [number, number, number];
type Theme = "light" | "dark";

/** Both sides of a `--name: light-dark(#day, #night)` token in globals.css. */
function token(name: string): Record<Theme, Rgb> {
  const match = css.match(new RegExp(`--${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, "i"));
  if (!match) throw new Error(`no light-dark token --${name}`);
  return { light: rgb(match[1]), dark: rgb(match[2]) };
}

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Machado, Oliveira and Fernandes (2009) at full severity, applied to linear RGB. */
const DICHROMACY: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(color: Rgb, matrix: number[][] | null): Rgb {
  if (!matrix) return color;
  const lin = color.map(linear);
  return matrix.map((row) => gamma(Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))) as Rgb;
}

/** Distance in OKLab, where about 0.02 is a difference seen side by side. */
function distance(a: Rgb, b: Rgb) {
  const lab = (c: Rgb) => {
    const [r, g, bl] = c.map(linear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const grounds = { "Rail Paper": token("paper-2"), Paper: token("paper"), Sheet: token("sheet") };
const palette = AREA_COLORS.map((name) => ({ name, ...token(`area-${name}`) }));

describe("area colour tokens", () => {
  it.each(["light", "dark"] as const)("hold 3:1 against every ground in %s (WCAG 1.4.11 for a mark)", (theme) => {
    for (const color of palette) {
      for (const [ground, value] of Object.entries(grounds)) {
        expect(contrast(color[theme], value[theme]), `${color.name} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(["light", "dark"] as const)("stay apart from each other, also under each dichromacy, in %s", (theme) => {
    for (const matrix of [null, ...Object.values(DICHROMACY)]) {
      for (const [i, a] of palette.entries()) {
        for (const b of palette.slice(i + 1)) {
          const apart = distance(simulate(a[theme], matrix), simulate(b[theme], matrix));
          expect(apart, `${a.name} and ${b.name}`).toBeGreaterThanOrEqual(0.025);
        }
      }
    }
  });

  it.each(["light", "dark"] as const)("never read as verdigris in %s", (theme) => {
    const accent = token("accent")[theme];
    for (const color of palette) expect(distance(color[theme], accent), color.name).toBeGreaterThanOrEqual(0.08);
  });

  it.each(["light", "dark"] as const)("never read as a status red or green in %s", (theme) => {
    // Reference alarm red and success green, as a common UI kit draws them; no palette colour should pass for either.
    const red = { light: rgb("#c62828"), dark: rgb("#ef5350") }[theme];
    const green = { light: rgb("#2e7d32"), dark: rgb("#66bb6a") }[theme];
    for (const color of palette) {
      expect(distance(color[theme], red), `${color.name} and red`).toBeGreaterThanOrEqual(0.095);
      expect(distance(color[theme], green), `${color.name} and green`).toBeGreaterThanOrEqual(0.095);
    }
  });

  it.each(["areas_color_palette", "tags_color_palette"])("are exactly the names %s accepts", (check) => {
    const clause = migration.match(new RegExp(`${check}\\s+check \\(color is null or color in \\(([^)]*)\\)`))?.[1];
    const allowed = clause?.match(/'(\w+)'/g)?.map((s) => s.slice(1, -1));
    expect(allowed).toEqual([...AREA_COLORS]);
  });

  it("are declared once each, in the palette's order", () => {
    const declared = [...css.matchAll(/--area-(\w+):/g)].map((m) => m[1]);
    expect(declared).toEqual([...AREA_COLORS]);
  });
});

describe("isAreaColor and areaColorLabel", () => {
  it("know the palette and nothing else", () => {
    expect(AREA_COLORS.every(isAreaColor)).toBe(true);
    for (const value of ["Clay", "red", "", null, undefined, 1, "accent"]) expect(isAreaColor(value)).toBe(false);
  });

  it("keeps every name 0009 allowed, so no stored area breaks the larger check", () => {
    for (const name of ["clay", "ochre", "moss", "sage", "slate", "plum", "rose", "stone"]) expect(isAreaColor(name)).toBe(true);
  });

  it("names None and each colour in sentence case", () => {
    expect(areaColorLabel(null)).toBe("None");
    expect(areaColorLabel("moss")).toBe("Moss");
  });
});
