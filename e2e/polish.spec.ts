import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// A busy week of its own, so these resets never meet another spec's account.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=polish` } });

signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([
    { name: "axiis-e2e-account", value: "polish", url: baseURL },
    { name: "tour", value: "done", url: baseURL },
  ]);
});

const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

signedIn.describe("surfaces", () => {
  signedIn("Next up and the List sit on raised cards over the paper", async ({ page }) => {
    await page.goto("/today?view=list");
    await hydrated(page);
    const card = page.getByRole("region", { name: "Next up" }).getByRole("list");
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toMatch(/inset/);
    expect(await card.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("12px");
  });

  signedIn("on a phone the header and the tab bar stay put, blurring the page behind them", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/today?view=list");
    await hydrated(page);
    expect(await style(page, "header.glass", "position")).toBe("sticky");
    expect(await style(page, "header.glass", "backdrop-filter")).toMatch(/blur\(10px\)/);
    expect(await style(page, "nav.glass-rail", "backdrop-filter")).toMatch(/blur\(10px\)/);
    await page.evaluate((y) => window.scrollBy(0, y), 600);
    await expect(page.locator("header.glass")).toBeInViewport();
  });
});

signedIn.describe("large titles", () => {
  for (const { path, width } of [
    { path: "/today?view=list", width: 1440 },
    { path: "/week", width: 1440 },
    { path: "/today", width: 375 },
  ]) {
    signedIn(`${path} at ${width} folds its title into a glass bar once the heading scrolls away, and back`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(path);
      await hydrated(page);
      const bar = page.locator(".title-bar");
      await expect(bar).not.toHaveAttribute("data-folded");
      await expect(bar.locator(".title-bar-text")).toHaveCSS("opacity", "0");
      await page.evaluate((y) => window.scrollBy(0, y), 700);
      await expect(bar).toHaveAttribute("data-folded");
      await expect(bar).toBeInViewport();
      expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toMatch(/blur/);
      const heading = await page.getByRole("heading", { level: 1 }).innerText();
      await expect(bar).toHaveText(heading.replace(/\s+/g, " "));
      await page.evaluate((y) => window.scrollBy(0, y), -2000);
      await expect(bar).not.toHaveAttribute("data-folded");
    });
  }

  signedIn("the Score's hour axis sticks under the bar, not behind it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto("/today");
    await hydrated(page);
    await page.evaluate((y) => window.scrollBy(0, y), 500);
    await expect(page.locator(".title-bar")).toHaveAttribute("data-folded");
    const bar = (await page.locator(".title-bar").boundingBox())!;
    const axis = (await page.getByRole("region", { name: "Score", exact: true }).locator(".sticky").first().boundingBox())!;
    expect(axis.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  });
});

/**
 * Counts the thumb slides the page starts from now on. Asking whether one is running at some instant would
 * miss a slide that ends before a slow run gets to ask.
 */
const watchSlides = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __slides: number };
    w.__slides = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (this.classList.contains("segment-thumb")) w.__slides++;
      return animate.apply(this, args);
    };
  });
const slides = (page: Page) => page.evaluate(() => (window as unknown as { __slides: number }).__slides);

signedIn.describe("segmented controls", () => {
  signedIn("the chosen span sits under an Ink thumb, which slides to the new span before the page turns", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    const span = page.getByRole("group", { name: "Day, week or month" });
    await expect(span.getByRole("link", { name: "Day" }).locator(".segment-thumb")).toHaveCount(1);
    await expect(span.getByRole("link", { name: "Day" })).toHaveCSS("color", await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    await watchSlides(page);
    await span.getByRole("link", { name: "Week" }).click();
    await expect.poll(() => slides(page)).toBeGreaterThan(0);
    await expect(page).toHaveURL(/week/);
    await expect(span.getByRole("link", { name: "Week" }).locator(".segment-thumb")).toHaveCount(1);
    await expect(span.getByRole("link", { name: "Week" })).toHaveAttribute("aria-current", "page");
  });

  signedIn("Score and List slide their thumb, and nothing slides under reduced motion", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    const view = page.getByRole("group", { name: "View" });
    await watchSlides(page);
    await view.getByRole("button", { name: "List" }).click();
    await expect.poll(() => slides(page)).toBeGreaterThan(0);
    await expect(view.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/view=list/);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const slid = await slides(page);
    await view.getByRole("button", { name: "Score" }).click();
    await expect(view.getByRole("button", { name: "Score" })).toHaveAttribute("aria-pressed", "true");
    expect(await slides(page)).toBe(slid);
    await expect(view.getByRole("button", { name: "Score" })).toHaveAttribute("aria-pressed", "true");
  });
});

/**
 * Counts the animations and transitions the page starts on rows other than a leaving one, from now on.
 * Asking what is running at one instant would miss a short one on a slow run.
 */
const watchMotion = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __motion: number };
    w.__motion = 0;
    const count = (e: Event) => {
      if (!(e.target as Element).closest?.("[data-ghost]")) w.__motion++;
    };
    document.addEventListener("animationstart", count, true);
    document.addEventListener("transitionrun", count, true);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (!this.closest("[data-ghost]")) w.__motion++;
      return animate.apply(this, args);
    };
  });
const motion = (page: Page) => page.evaluate(() => (window as unknown as { __motion: number }).__motion);

signedIn.describe("rows that move", () => {
  const list = (page: Page) => page.getByRole("region", { name: "List", exact: true });

  signedIn("a deleted row fades where it stood while the rows below close up, and comes back settling in", async ({ page }) => {
    await page.goto("/today?view=list");
    await hydrated(page);
    // The first open row of the day, so there are rows below it to close up.
    const first = list(page).locator("ul").first().locator(":scope > li[data-quick]").first();
    const key = (await first.getAttribute("data-quick"))!;
    await first.getByRole("button").first().focus();
    await watchMotion(page);
    await page.keyboard.press("Delete");
    await expect(list(page).locator("li[data-ghost]")).toHaveCount(1);
    await expect.poll(() => motion(page)).toBeGreaterThan(0);
    await expect(list(page).locator("li[data-ghost]")).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(list(page).locator(`li[data-quick="${key}"]`)).toBeVisible();
  });

  signedIn("under reduced motion rows change at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/today?view=list");
    await hydrated(page);
    await list(page).getByRole("button", { name: /^Call the plumber/ }).focus();
    await page.keyboard.press("Delete");
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toHaveCount(0);
    await expect(list(page).locator("li[data-ghost]")).toHaveCount(0);
    expect(await list(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  signedIn("a capture on the Inbox settles in at the top", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    await page.locator("#capture").fill("Water the ferns");
    await page.keyboard.press("Enter");
    const row = page.locator("[data-quick]").filter({ has: page.getByRole("button", { name: /^Water the ferns/ }) });
    await expect(row).toBeVisible();
  });
});

signedIn.describe("comfort and access", () => {
  signedIn("asking for less transparency makes every bar solid, with nothing blurred", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await page.goto("/today?view=list");
    await hydrated(page);
    await page.evaluate(() => window.scrollBy(0, 700));
    await expect(page.locator(".title-bar")).toHaveAttribute("data-folded");
    for (const selector of ["header.glass", "nav.glass-rail", ".title-bar"]) {
      expect(await style(page, selector, "backdrop-filter"), selector).toBe("none");
      expect(await style(page, selector, "background-color"), selector).toMatch(/^rgb\(/);
    }
  });

  for (const colorScheme of ["light", "dark"] as const) {
    signedIn(`a segment in focus shows the Verdigris ring in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/today");
      await hydrated(page);
      const list = page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" });
      await list.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(list).toBeFocused();
      const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent"));
      expect(accent).toBeTruthy();
      await expect(list).toHaveCSS("outline-style", "solid");
      await expect(list).toHaveCSS("outline-width", "2px");
    });
  }
});

signedIn.describe("no axe violations on the polished surfaces", () => {
  for (const { width, colorScheme } of [
    { width: 1440, colorScheme: "light" as const },
    { width: 1440, colorScheme: "dark" as const },
    { width: 375, colorScheme: "dark" as const },
    { width: 375, colorScheme: "light" as const },
  ]) {
    signedIn(`Today's List and the Week at ${width} in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const path of ["/today?view=list", "/week"]) {
        await page.goto(path);
        await hydrated(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    });
  }
});
