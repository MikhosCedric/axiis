import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/dev/no-such-page",
  "/dev/score",
  "/dev/score?view=list",
  "/dev/score?tray=empty",
  "/dev/week",
  "/dev/inbox",
  "/dev/inbox?empty",
  "/dev/detail",
  "/dev/detail?item=00000000-0000-4000-8000-000000000001",
  "/dev/detail?item=00000000-0000-4000-8000-000000000060~2026-10-09",
  "/dev/notes",
  "/dev/notes/00000000-0000-4000-8000-000000000020",
  "/dev/notes/search?q=bulbs",
  "/dev/settings",
];

const VARIANTS = [
  { name: "light", colorScheme: "light", viewport: { width: 1280, height: 800 } },
  { name: "dark", colorScheme: "dark", viewport: { width: 1280, height: 800 } },
  { name: "phone", colorScheme: "light", viewport: { width: 390, height: 844 } },
] as const;

for (const variant of VARIANTS) {
  test.describe(variant.name, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    for (const path of PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        const blocking = violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
        expect(blocking).toEqual([]);
      });
    }
  });
}
