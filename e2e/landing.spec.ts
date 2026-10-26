import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hydrated } from "./session";

/** Console errors and page errors seen while a test runs; each test asserts there were none. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Scrolls the page through once, so every section has been revealed, then waits for motion to settle. */
async function settle(page: Page) {
  await hydrated(page);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.timeline !== document.timeline || a.effect?.getTiming().iterations === Infinity),
  );
}

/** How strongly a part of the day's name is drawn in the run, 0 to 1: its opacity times its parents', rounded. */
function shown(run: Locator, name: string): Promise<number> {
  return run.getByText(name, { exact: true }).evaluate((el) => {
    let o = 1;
    for (let n: Element | null = el; n && n.getAttribute("role") !== "group"; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return Math.round(o * 10) / 10;
  });
}

test.describe("the live score", () => {
  test.use({ timezoneId: "UTC" });

  test("is laid around the visitor's own time, on the clock they pick", async ({ page }) => {
    const errors = watchErrors(page);
    await page.clock.install({ time: new Date("2026-03-04T15:42:10Z") });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your tasks and your time, on one page." })).toBeVisible();
    const figure = page.getByRole("figure", { name: /A sample day/ });
    await expect(figure).toBeVisible();

    // The beam that is on now, and its neighbours, read in the visitor's hours.
    const work = figure.getByRole("list", { name: "Work line" });
    await expect(work.getByRole("listitem").filter({ hasText: "Review Ana's draft" })).toHaveText(
      "Review Ana's draft, 14:30 to 16:15, happening now, 2 of 3 subtasks done",
    );
    await expect(work.getByRole("listitem").filter({ hasText: "Write the quarterly summary" })).toContainText("done");
    await expect(work.getByRole("listitem").filter({ hasText: "Plan next week" })).toContainText("17:00 to 18:30, planned");

    await figure.getByRole("button", { name: "12-hour" }).click();
    await expect(figure.getByRole("button", { name: "12-hour" })).toHaveAttribute("aria-pressed", "true");
    await expect(work.getByRole("listitem").filter({ hasText: "Review Ana's draft" })).toContainText("2:30 PM to 4:15 PM");
    expect(errors).toEqual([]);
  });
});

test("every demo works from the keyboard", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await hydrated(page);

  // Capture: the app's parser reads the line, and Enter says where it lands.
  const line = page.getByLabel("Type a line");
  await line.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("call Sam friday 14:00 for 30m #home");
  await expect(line).toHaveAccessibleDescription("Reads Friday, 14:00 to 14:30, #home");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "“call Sam” lands Friday at 14:00." })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("buy milk");
  await expect(line).toHaveAccessibleDescription("No day or time: it waits in the Inbox.");

  // Drag: arrows move a quarter hour, Shift and an arrow move the end.
  const beam = page.getByRole("button", { name: /^Plan next week/ });
  await beam.focus();
  await page.keyboard.press("ArrowRight");
  await expect(beam).toHaveAccessibleName("Plan next week 14:15 to 15:45");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(beam).toHaveAccessibleName("Plan next week 14:15 to 16:00");
  await expect(page.getByRole("status").filter({ hasText: "Plan next week, 14:15 to 16:00." })).toBeVisible();

  // Done: the glyph is the done box.
  const tick = page.getByRole("checkbox", { name: "Done: Review Ana's draft" });
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(tick).toBeChecked();
  await expect(page.getByRole("status").filter({ hasText: "Review Ana's draft is done." })).toBeVisible();

  // Focus: the day folds to what is happening and the next three.
  const focus = page.getByRole("button", { name: "Focus", exact: true });
  await focus.focus();
  await page.keyboard.press("Enter");
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  const fold = page.getByRole("button", { name: /The whole day/ });
  await expect(fold).toHaveText("The whole day 2 more planned · 2 done");
  await expect(fold.locator("xpath=preceding-sibling::ol[1]").getByRole("listitem")).toHaveCount(4);
  await fold.focus();
  await page.keyboard.press("Enter");
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(fold.locator("xpath=preceding-sibling::ol[1]").getByRole("listitem")).toHaveCount(8);

  // Month: the grid's keys move a day or a week, and the day is listed beside it.
  const grid = page.getByRole("grid");
  const start = grid.locator('[role="gridcell"][tabindex="0"]');
  await start.focus();
  const before = await page.getByRole("region", { name: "The day shown" }).getByRole("heading").innerText();
  await page.keyboard.press("ArrowDown");
  const after = await page.getByRole("region", { name: "The day shown" }).getByRole("heading").innerText();
  expect(after).not.toBe(before);
  await expect(page.locator(":focus")).toHaveAttribute("role", "gridcell");
  await expect(page.locator(":focus")).toContainText(after);
  expect(errors).toEqual([]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the page is a complete, still composition", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await hydrated(page);
    await page.evaluate(async () => {
      scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const motion = await page.evaluate(() => ({
      running: document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => (a instanceof CSSAnimation ? a.animationName : a instanceof CSSTransition ? a.transitionProperty : "script")),
      held: document.querySelectorAll('[data-reveal="wait"]').length,
      faint: [...document.querySelectorAll("main *")].filter((el) => Number(getComputedStyle(el).opacity) < 1 && el.closest("[aria-hidden=true]") === null).length,
    }));
    expect(motion).toEqual({ running: [], held: 0, faint: 0 });
    expect(errors).toEqual([]);
  });

  test("the run is one still moment, not a stretch of page to scroll through", async ({ page }) => {
    await page.goto("/");
    const run = page.getByRole("group", { name: "A day, as it goes." });
    const height = (await run.boundingBox())!.height;
    expect(height).toBeLessThan(page.viewportSize()!.height);
    await expect.poll(() => shown(run, "Afternoon")).toBe(1);
    await expect.poll(() => shown(run, "Morning")).toBe(0);
  });
});

test.describe("the run through the day", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("carries now from morning to evening as the reader scrolls, and back", async ({ page }) => {
    await page.goto("/");
    const run = page.getByRole("group", { name: "A day, as it goes." });
    const at = async (share: number) => {
      await run.evaluate((el, share) => {
        const top = el.getBoundingClientRect().top + scrollY;
        scrollTo(0, top + share * (el.getBoundingClientRect().height - innerHeight));
      }, share);
    };
    // The stage is held while the run scrolls past: three screens or so of scroll, never a jump.
    expect((await run.boundingBox())!.height).toBeGreaterThan(2 * 900);
    await at(0.02);
    await expect.poll(() => shown(run, "Morning")).toBe(1);
    await expect.poll(() => shown(run, "Evening")).toBe(0);
    await at(0.98);
    await expect.poll(() => shown(run, "Evening")).toBe(1);
    await expect.poll(() => shown(run, "Morning")).toBe(0);
    await at(0.02);
    await expect.poll(() => shown(run, "Morning")).toBe(1);
  });
});

for (const size of [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test.describe(`at ${size.width}px`, () => {
    test.use({ viewport: size });

    test("the page uses the width: the sample day spans it, with no sideways scroll", async ({ page }) => {
      await page.goto("/");
      // The sheet the sample day is drawn on, inside the page's gutters.
      const sheet = page.getByRole("figure", { name: /A sample day/ }).locator("xpath=..");
      const box = (await sheet.boundingBox())!;
      expect(box.width / size.width).toBeGreaterThanOrEqual(0.9);
      const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(heading.width / size.width).toBeGreaterThanOrEqual(0.6);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  });
}

test("no width from a small phone to an ultrawide scrolls sideways", async ({ page }) => {
  for (const [width, height] of [
    [320, 700],
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [3440, 1440],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await settle(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px`).toBe(0);
  }
});

test("sign in opens with a view transition and the brand mark carried over", async ({ page }) => {
  const errors = watchErrors(page);
  // Each view transition React starts, by the names it gave the old page's elements to carry over.
  await page.addInitScript(() => {
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    const seen: string[][] = [];
    (window as unknown as { transitions: string[][] }).transitions = seen;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      seen.push([...document.querySelectorAll<HTMLElement>("*")].map((el) => el.style.viewTransitionName).filter(Boolean));
      return start(arg);
    }) as typeof document.startViewTransition;
  });
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Axiis" })).toBeVisible();
  const transitions = await page.evaluate(() => (window as unknown as { transitions: string[][] }).transitions);
  expect(transitions.length).toBeGreaterThan(0);
  expect(transitions.flat()).toContain("brand-mark");

  await page.getByRole("link", { name: "Axiis" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the day and night switch re-tints the page without a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const day = await paper();
  await page.getByRole("button", { name: "Switch between light and dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(paper).not.toBe(day);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const variant of [
  { name: "light", colorScheme: "light", viewport: { width: 1280, height: 800 } },
  { name: "dark", colorScheme: "dark", viewport: { width: 1280, height: 800 } },
  { name: "phone", colorScheme: "light", viewport: { width: 375, height: 812 } },
  { name: "phone at night", colorScheme: "dark", viewport: { width: 375, height: 812 } },
  { name: "wide at night", colorScheme: "dark", viewport: { width: 2560, height: 1440 } },
] as const) {
  test.describe(variant.name, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    test("the landing has no axe violations and no sideways scroll", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  });
}
