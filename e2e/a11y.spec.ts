import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signedIn } from "./session";

const PAGES = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/dev/no-such-page",
  "/dev/score",
  "/dev/score?view=list",
  "/dev/score?view=list&item=f0000000-0000-4000-8000-000000000006",
  "/dev/score?view=list&item=f0000000-0000-4000-8000-000000000007",
  "/dev/score?tray=empty",
  "/dev/score?firstday",
  "/dev/week",
  "/dev/inbox",
  "/dev/inbox?empty",
  "/dev/inbox?item=f2000000-0000-4000-8000-000000000003",
  "/dev/inbox?item=f2000000-0000-4000-8000-000000000005",
  "/dev/lists",
  "/dev/lists?empty",
  "/dev/lists?item=f3000000-0000-4000-8000-000000000002",
  "/dev/lists?item=f3000000-0000-4000-8000-000000000005",
  "/dev/detail",
  "/dev/detail?item=00000000-0000-4000-8000-000000000001",
  "/dev/detail?item=00000000-0000-4000-8000-000000000060~2026-10-09",
  "/dev/detail?item=00000000-0000-4000-8000-000000000060",
  "/dev/notes",
  "/dev/notes/00000000-0000-4000-8000-000000000020",
  "/dev/notes/search?q=bulbs",
  "/dev/settings",
  "/dev/tags",
  "/dev/tags/errands",
  "/dev/tags/errands?item=00000000-0000-4000-8000-000000000004",
];

const VARIANTS = [
  { name: "light", colorScheme: "light", viewport: { width: 1280, height: 800 } },
  { name: "dark", colorScheme: "dark", viewport: { width: 1280, height: 800 } },
  { name: "phone", colorScheme: "light", viewport: { width: 390, height: 844 } },
] as const;

// Pages whose layout changes at a wide window, checked again at 1920 in both themes.
const WIDE_PAGES = ["/", "/login", "/dev/settings", "/dev/notes", "/dev/notes/00000000-0000-4000-8000-000000000020"];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`wide ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 1920, height: 1080 } });

    for (const path of WIDE_PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      });
    }
  });
}

for (const variant of VARIANTS) {
  test.describe(variant.name, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    for (const path of PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await blockingViolations(page)).toEqual([]);
      });
    }
  });
}

// The real signed-in screens on the busy account, which draws every kind of item: beams, chips, due marks, tags,
// rows and month marks. Read only, so they can share the account with the specs that tick it.
const SIGNED_IN = ["/today", "/today?view=list", "/week", "/month", "/inbox", "/due", "/lists", "/tags"];
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
}

for (const variant of VARIANTS) {
  for (const clock of ["12", "24"] as const) {
    signedIn.describe(`signed in, ${variant.name}, ${clock}-hour`, () => {
      signedIn.use({ colorScheme: variant.colorScheme, viewport: variant.viewport, timezoneId: zone });

      for (const path of SIGNED_IN) {
        signedIn(`${path} has no serious or critical axe violations`, async ({ page, baseURL }) => {
          await page.context().addCookies([
            { name: "axiis-e2e-account", value: "busy", url: baseURL },
            { name: "clock", value: clock, url: baseURL },
          ]);
          await page.goto(path);
          await expect(page.locator("h1").first()).toBeVisible();
          expect(await blockingViolations(page)).toEqual([]);
        });
      }
    });
  }
}
