import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAPER_DARK, PAPER_LIGHT } from "./theme-colors";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const icon = readFileSync(join(__dirname, "../app/icon.svg"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css has no ${selector} block`);
  return css.slice(start, css.indexOf("}", start));
}

const paperIn = (selector: string) => block(selector).match(/--paper:\s*(#[0-9a-f]{6})/i)?.[1];

describe("theme colours outside CSS", () => {
  it("match the light paper token", () => {
    expect(paperIn(":root")).toBe(PAPER_LIGHT);
  });

  it("match the dark paper token in both dark blocks", () => {
    expect(paperIn(':root[data-theme="dark"]')).toBe(PAPER_DARK);
    expect(paperIn(':root:not([data-theme="light"])')).toBe(PAPER_DARK);
  });

  it("are the colours the app icon is drawn in", () => {
    expect(icon).toContain(PAPER_LIGHT);
    expect(icon).toContain(PAPER_DARK);
  });
});
