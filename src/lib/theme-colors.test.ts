import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAPER_DARK, PAPER_LIGHT } from "./theme-colors";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const icon = readFileSync(join(__dirname, "../app/icon.svg"), "utf8");

/** The two sides of the paper token, declared once as light-dark(day, night) on :root. */
const paper = css.match(/--paper:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);

describe("theme colours outside CSS", () => {
  it("match the light paper token", () => {
    expect(paper?.[1]).toBe(PAPER_LIGHT);
  });

  it("match the dark paper token", () => {
    expect(paper?.[2]).toBe(PAPER_DARK);
  });

  it("are the colours the app icon is drawn in", () => {
    expect(icon).toContain(PAPER_LIGHT);
    expect(icon).toContain(PAPER_DARK);
  });
});
