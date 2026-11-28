import { expect, type Page } from "@playwright/test";
import { signedIn } from "./session";

// The page head (page-header.tsx, the page-header utility): its parts never overlap, nothing hangs outside it,
// and the capture's preview line has room of its own, so the grid below does not move when it appears.

const box = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }, selector);

type Box = NonNullable<Awaited<ReturnType<typeof box>>>;
const apart = (a: Box, b: Box) => a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;

const pages = [
  { path: "/today", title: "#day-title" },
  { path: "/week", title: "#week-title" },
  { path: "/month", title: "#month-h" },
];

for (const width of [1160, 1440, 1920]) {
  signedIn.describe(`at ${width}px`, () => {
    signedIn.use({ viewport: { width, height: 900 } });

    for (const { path, title } of pages) {
      signedIn(`${path}: title, steps, capture, controls and preview do not overlap and stay inside the head`, async ({ page }) => {
        await page.goto(path);
        await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator(title)).toBeVisible();

        const before = await box(page, "[data-calendar-grid], section[aria-label='Days of the month']");
        await page.locator("#capture").fill("Test tomorrow 10:30");
        await expect(page.locator("#capture-preview")).toBeVisible();

        const parts = {
          steps: await box(page, "main header nav"),
          title: await box(page, title),
          capture: await box(page, "#capture"),
          controls: await box(page, "main header [data-slot='ctl']"),
          preview: await box(page, "#capture-preview"),
        };
        const head = (await box(page, "main header"))!;
        for (const [name, b] of Object.entries(parts)) {
          expect(b, name).not.toBeNull();
          expect(b!.left, `${name} left`).toBeGreaterThanOrEqual(head.left - 0.5);
          expect(b!.right, `${name} right`).toBeLessThanOrEqual(head.right + 0.5);
          expect(b!.bottom, `${name} bottom`).toBeLessThanOrEqual(head.bottom + 0.5);
        }
        const names = Object.keys(parts) as (keyof typeof parts)[];
        for (let i = 0; i < names.length; i++)
          for (let j = i + 1; j < names.length; j++) {
            // The preview sits under the capture field, which is the one pair allowed to share edges, never area.
            expect(apart(parts[names[i]]!, parts[names[j]]!), `${names[i]} overlaps ${names[j]}`).toBe(true);
          }
        // Nothing moved: the grid is where it was before the preview showed.
        const after = await box(page, "[data-calendar-grid], section[aria-label='Days of the month']");
        expect(after!.top).toBeCloseTo(before!.top, 0);
      });
    }
  });
}

signedIn.describe("at 375px", () => {
  signedIn.use({ viewport: { width: 375, height: 812 } });

  signedIn("/week: the folded title names the same three days as the heading, not the whole week", async ({ page }) => {
    await page.goto("/week");
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    const heading = page.locator("#week-title");
    await expect(heading).toBeVisible();
    const bar = page.locator(".title-bar-text");
    const compare = async () => {
      const [h, b] = [await heading.innerText(), ((await bar.textContent()) ?? "").trim()];
      return b !== "" && h.includes(b) ? "same" : `bar "${b}" vs heading "${h}"`;
    };
    await expect.poll(compare).toBe("same");
  });
});
