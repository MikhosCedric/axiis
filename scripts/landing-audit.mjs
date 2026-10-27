// Measures the landing at many widths: the size of each type role, the tallest empty band between
// pieces of text, and full-page and per-screen screenshots. Point it at a running production build.
// Usage: node scripts/landing-audit.mjs [baseURL] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3710";
const out = process.argv[3] ?? "landing-audit";
mkdirSync(out, { recursive: true });

const SIZES = [
  [375, 812],
  [768, 1024],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
];

/** Each type role on the page, by what it is rather than by class, so the script outlives a rename. */
const ROLES = {
  display: "h1",
  h2: "main h2",
  h3: "main h3",
  lead: "main section:first-of-type p",
  body: "main article p",
  ledger: "main li",
  tally: "main dt",
  button: "main a[href='/login']",
};

const browser = await chromium.launch({ channel: "msedge" });
const report = [];
for (const scheme of ["light", "dark"]) {
  for (const [width, height] of SIZES) {
    if (scheme === "dark" && ![375, 1440, 2560].includes(width)) continue;
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(base + "/");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    const m = await page.evaluate((roles) => {
      const px = (el) => parseFloat(getComputedStyle(el).fontSize);
      const sizes = {};
      for (const [role, sel] of Object.entries(roles)) {
        const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
        if (els.length) sizes[role] = Math.max(...els.map(px));
      }
      const phase = document.querySelector("[data-phase-name]") ?? [...document.querySelectorAll("span")].find((s) => s.textContent === "Afternoon");
      if (phase) sizes.phase = px(phase);
      const button = document.querySelector("main a[href='/login']")?.getBoundingClientRect();
      const figure = document.querySelector("figure")?.getBoundingClientRect();
      const h1 = document.querySelector("h1").getBoundingClientRect();
      // Every box that draws text or a control, top to bottom, to find the tallest stretch with nothing in it.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const spans = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        for (const box of r.getClientRects()) if (box.height > 0) spans.push([box.top + scrollY, box.bottom + scrollY]);
      }
      spans.sort((a, b) => a[0] - b[0]);
      let gap = 0;
      let gapAt = 0;
      let reach = 0;
      for (const [top, bottom] of spans) {
        if (reach && top - reach > gap) {
          gap = top - reach;
          gapAt = reach;
        }
        reach = Math.max(reach, bottom);
      }
      return {
        sizes,
        button: button && { h: Math.round(button.height), w: Math.round(button.width) },
        figure: figure && { w: Math.round(figure.width), h: Math.round(figure.height) },
        h1: { w: Math.round(h1.width), h: Math.round(h1.height) },
        pageHeight: document.documentElement.scrollHeight,
        emptiestBand: { px: Math.round(gap), at: Math.round(gapAt) },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, ROLES);
    report.push({ width, height, scheme, ...m });
    const name = `${width}-${scheme}`;
    await page.screenshot({ path: join(out, `${name}-full.png`), fullPage: true });
    console.log(name, JSON.stringify(m));
    await page.close();
  }
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
