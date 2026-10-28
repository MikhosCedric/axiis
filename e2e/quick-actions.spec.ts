import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hydrated, SESSION_COOKIE, sessionSecret, signedIn } from "./session";

// The busy account seeds its week around the server's real today in the server's own zone; the browser takes that zone too.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const reset = (request: APIRequestContext) =>
  request.post("/dev/e2e-session", { headers: { cookie: `${SESSION_COOKIE}=${sessionSecret()}; axiis-e2e-account=busy` } });

// One in-memory account is shared by every worker, and these tests change it, so they run one at a time.
signedIn.describe.configure({ mode: "serial" });
signedIn.use({ timezoneId: zone });

signedIn.beforeEach(async ({ page, request, baseURL }) => {
  expect((await reset(request)).status()).toBe(204);
  await page.context().addCookies([{ name: "axiis-e2e-account", value: "busy", url: baseURL }]);
});

/** Today's List; Next up above it can hold the same items, depending on the hour. */
const list = (page: Page) => page.getByRole("region", { name: "List", exact: true });
const score = (page: Page) => page.getByRole("region", { name: "Score", exact: true });
const row = (page: Page, title: string) => list(page).locator("[data-quick]").filter({ has: page.getByRole("button", { name: title, exact: false }) }).first();
const note = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ }).last();

async function openList(page: Page) {
  await page.goto("/today?view=list");
  await hydrated(page);
}

signedIn.describe("quick actions on a row", () => {
  signedIn("show under the pointer and on focus, in room the row already has", async ({ page }) => {
    await openList(page);
    const plumber = row(page, "Call the plumber");
    const rename = plumber.locator("[data-quick-cluster]");
    await page.mouse.move(0, 0);
    await expect(rename).toHaveCSS("opacity", "0");
    await plumber.scrollIntoViewIfNeeded();
    const size = async () => {
      const box = (await plumber.boundingBox())!;
      return [box.width, box.height];
    };
    const before = await size();
    await plumber.getByRole("button", { name: /^Call the plumber/ }).hover();
    await expect(rename).toHaveCSS("opacity", "1");
    expect(await size()).toEqual(before);

    await page.mouse.move(0, 0);
    await expect(rename).toHaveCSS("opacity", "0");
    await plumber.getByRole("button", { name: /^Call the plumber/ }).focus();
    await expect(rename).toHaveCSS("opacity", "1");
  });

  signedIn("rename in place with E: Enter saves, Escape keeps the old title, empty keeps it", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.focus();
    await page.keyboard.press("e");
    const field = page.getByRole("textbox", { name: "Rename Call the plumber" });
    await expect(field).toBeFocused();
    await field.fill("Ring the plumber");
    await page.keyboard.press("Escape");
    await expect(title).toBeFocused();

    await page.keyboard.press("e");
    await field.fill("   ");
    await page.keyboard.press("Enter");
    await expect(title).toBeFocused();

    await page.keyboard.press("e");
    await field.fill("Ring the plumber");
    await page.keyboard.press("Enter");
    const renamed = list(page).getByRole("button", { name: /^Ring the plumber/ });
    await expect(renamed).toBeVisible();
    await expect(renamed).toBeFocused();
    await page.reload();
    await expect(list(page).getByRole("button", { name: /^Ring the plumber/ })).toBeVisible();
  });

  signedIn("D ticks it, and Delete takes it away with Undo, Ctrl Z too", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.focus();
    await page.keyboard.press("d");
    await expect(list(page).getByRole("checkbox", { name: "Done: Call the plumber" })).toBeChecked();
    await page.keyboard.press("d");
    await expect(list(page).getByRole("checkbox", { name: "Done: Call the plumber" })).not.toBeChecked();

    await title.focus();
    await page.keyboard.press("Delete");
    await expect(title).toHaveCount(0);
    await expect(note(page)).toHaveText("Call the plumber is deleted.");
    await page.keyboard.press("Control+z");
    await expect(note(page)).toHaveText("Call the plumber is back.");
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toBeFocused();

    await list(page).getByRole("button", { name: /^Call the plumber/ }).hover();
    await list(page).getByRole("button", { name: "Delete Call the plumber" }).click();
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toBeVisible();
  });

  signedIn("a right-click opens every action as a menu; arrows move, Escape closes it and focus comes back", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.click({ button: "right" });
    const menu = page.getByRole("menu", { name: "Actions for Call the plumber" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      /^Done/,
      /^Rename/,
      /^Plan…/,
      /^Area and tags…/,
      /^Delete/,
      "Duplicate",
      "Make it an event",
      "Move to the Inbox",
      "Open details",
      /^Choose/,
    ]);
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: /^Choose/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: "Open details" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(title).toBeFocused();
    await expect(page).toHaveURL(/view=list$/);

    await page.keyboard.press(".");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(note(page)).toHaveText("Call the plumber is copied.");
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toHaveCount(2);
  });

  signedIn("plan from the cluster, with Undo", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    const title = page.getByRole("button", { name: /^Read the lease/ });
    await title.hover();
    await page.getByRole("button", { name: "Plan Read the lease" }).click();
    const plan = page.getByRole("dialog", { name: "Plan Read the lease" });
    await expect(plan.getByRole("button", { name: "Today" })).toBeFocused();
    await plan.getByRole("button", { name: "Tomorrow" }).click();
    await expect(title).toHaveCount(0);
    await expect(note(page)).toHaveText("Read the lease is planned for tomorrow.");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: /^Read the lease/ })).toBeVisible();
  });

  signedIn("area and tags from the cluster", async ({ page }) => {
    await page.goto("/inbox");
    await hydrated(page);
    await page.getByRole("button", { name: /^Read the lease/ }).hover();
    await page.getByRole("button", { name: "Area and tags Read the lease" }).click();
    const labels = page.getByRole("dialog", { name: "Area and tags for Read the lease" });
    await expect(labels.getByRole("radio", { name: "Home" })).toBeFocused();
    await labels.getByRole("radio", { name: "Work" }).click();
    await expect(labels.getByRole("radio", { name: "Work" })).toBeChecked();
    await labels.getByRole("combobox").fill("paperwork");
    await page.keyboard.press("Enter");
    await expect(labels.getByText("#paperwork")).toBeVisible();
    // The first Escape closes the field's suggestions, the next the popover.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(labels).toBeHidden();
    await expect(page.locator("[data-quick]").filter({ hasText: "Read the lease" })).toContainText("Work");
  });

  signedIn("one time a series happens asks before it goes: skip this day, with Undo", async ({ page }) => {
    await openList(page);
    const standup = list(page).getByRole("button", { name: /^Standup/ });
    await standup.focus();
    await page.keyboard.press("Delete");
    const ask = page.getByRole("dialog", { name: "Delete Standup" });
    await expect(ask.getByRole("button", { name: "Skip this day" })).toBeFocused();
    await ask.getByRole("button", { name: "Delete every time…" }).click();
    await expect(page.getByRole("dialog", { name: "Delete every time it repeats?" }).getByRole("button", { name: "Keep it" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(standup).toBeFocused();

    await page.keyboard.press("Delete");
    await page.getByRole("button", { name: "Skip this day" }).click();
    await expect(standup).toHaveCount(0);
    await expect(note(page)).toHaveText("Standup is skipped on this day.");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(list(page).getByRole("button", { name: /^Standup/ })).toBeVisible();
  });
});

signedIn.describe("quick actions on the Score", () => {
  signedIn("a beam shows its actions beside its end, and still drags and answers its keys", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/today");
    await hydrated(page);
    const beam = page.locator("[data-quick][role=button]").filter({ hasText: "Call the plumber" }).first();
    await beam.scrollIntoViewIfNeeded();
    await beam.hover();
    const cluster = score(page).getByRole("button", { name: "Rename Call the plumber" });
    await expect(cluster).toBeVisible();
    const b = (await beam.boundingBox())!;
    const c = (await cluster.boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(b.x + b.width);

    // Delete and Backspace keep their meaning on the Score: back to the Inbox.
    const before = await beam.getAttribute("aria-label");
    // Focus and press again until the key takes, as a slow run can press before the row's key handler is live.
    await expect(async () => {
      await beam.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("[data-quick][role=button]").filter({ hasText: "Call the plumber" }).first()).not.toHaveAttribute("aria-label", before!, { timeout: 1500 });
    }).toPass();

    const moved = page.locator("[data-quick][role=button]").filter({ hasText: "Call the plumber" }).first();
    const label = await moved.getAttribute("aria-label");
    // A move slides the beam to its new place; press where it has come to rest, not where it was.
    let box = (await moved.boundingBox())!;
    await expect(async () => {
      const again = (await moved.boundingBox())!;
      const still = JSON.stringify(again) === JSON.stringify(box);
      box = again;
      expect(still).toBe(true);
    }).toPass({ intervals: [150, 150, 250, 500] });
    // Drag toward the side with room: by the hour the page opens at, 18:15 can sit at the Score's right edge.
    const edge = (await score(page).boundingBox())!;
    const to = box.x + box.width / 3 + 76 < edge.x + edge.width - 24 ? 76 : -76;
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 3 + to, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator("[data-quick][role=button]").filter({ hasText: "Call the plumber" }).first()).not.toHaveAttribute("aria-label", label!);
  });

  signedIn("rename a beam in a popover", async ({ page }) => {
    await page.goto("/today");
    await hydrated(page);
    const beam = page.locator("[data-quick][role=button]").filter({ hasText: "Call the plumber" }).first();
    await beam.focus();
    await page.keyboard.press("e");
    const field = page.getByRole("dialog", { name: "Rename Call the plumber" }).getByRole("textbox");
    await expect(field).toBeFocused();
    await field.fill("Ring the plumber");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-quick][role=button]").filter({ hasText: "Ring the plumber" })).toBeVisible();
  });
});

signedIn.describe("quick actions have no axe violations", () => {
  for (const { width, colorScheme } of [
    { width: 1440, colorScheme: "light" as const },
    { width: 1440, colorScheme: "dark" as const },
    { width: 375, colorScheme: "light" as const },
  ]) {
    signedIn(`at ${width} in ${colorScheme}, with a row's actions showing and its menu open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await openList(page);
      const title = list(page).getByRole("button", { name: /^Call the plumber/ });
      await title.focus();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press(".");
      await expect(page.getByRole("menu")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");
      await page.keyboard.press("p");
      await expect(page.getByRole("dialog", { name: "Plan Call the plumber" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
});

signedIn.describe("the popovers and menus", () => {
  signedIn("a click outside closes one and leaves focus where the click put it", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.focus();
    await page.keyboard.press("p");
    const plan = page.getByRole("dialog", { name: "Plan Call the plumber" });
    await expect(plan).toBeVisible();
    await page.getByRole("textbox", { name: /Capture/ }).click();
    await expect(plan).toBeHidden();
    await expect(page.getByRole("textbox", { name: /Capture/ })).toBeFocused();
  });

  signedIn("Tab past the last control closes it and goes back to the row; arrows move between its choices", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.focus();
    await page.keyboard.press("p");
    const plan = page.getByRole("dialog", { name: "Plan Call the plumber" });
    await expect(plan.getByRole("button", { name: "Today" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(plan.getByRole("button", { name: "Tomorrow" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(plan.getByRole("button", { name: "Next week" })).toBeFocused();
    await plan.getByRole("button", { name: "Any time" }).focus();
    await page.keyboard.press("Tab");
    await expect(plan).toBeHidden();
    await expect(title).toBeFocused();
  });

  signedIn("a trigger says when its layer is open, and a menu hands over to Plan in the same place", async ({ page }) => {
    await openList(page);
    const title = list(page).getByRole("button", { name: /^Call the plumber/ });
    await title.hover();
    const more = list(page).getByRole("button", { name: "More Call the plumber" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menu", { name: "Actions for Call the plumber" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");

    await title.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Plan…" }).click();
    const plan = page.getByRole("dialog", { name: "Plan Call the plumber" });
    await expect(plan.getByRole("button", { name: "Today" })).toBeFocused();
    await expect(plan.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
    await plan.getByRole("textbox", { name: "At" }).fill("7pm");
    await page.keyboard.press("Enter");
    await expect(note(page)).toHaveText(/^Call the plumber is at 19:00 now\.$/);
    await expect(title).toBeFocused();
  });
});

signedIn.describe("quick actions under a coarse pointer", () => {
  signedIn.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } });

  signedIn("keep one 44px More button per row, whose menu holds every action", async ({ page }) => {
    await openList(page);
    const plumber = row(page, "Call the plumber");
    await expect(plumber.getByRole("button", { name: "Rename Call the plumber" })).toBeHidden();
    const more = plumber.getByRole("button", { name: "More Call the plumber" });
    await expect(more).toBeVisible();
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await more.click();
    const menu = page.getByRole("menu", { name: "Actions for Call the plumber" });
    await expect(menu.getByRole("menuitem", { name: /^Rename/ })).toBeVisible();
    await menu.getByRole("menuitem", { name: /^Delete/ }).click();
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(list(page).getByRole("button", { name: /^Call the plumber/ })).toBeVisible();
  });
});
