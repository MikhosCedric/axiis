import AxeBuilder from "@axe-core/playwright";
import { expect as defaultExpect, test, type Locator, type Page } from "@playwright/test";
import { SESSION_COOKIE, sessionHeader, signedIn } from "./session";

// A client navigation waits on the server render of the next route; see the timeout note below.
const expect = defaultExpect.configure({ timeout: 30_000 });

// The real signed-in routes, as the in-memory account from src/lib/supabase/fake-account.ts. See docs/e2e-session.md.

/** Tomorrow's date in the zone the app plans in: the tz cookie, or UTC without one. */
async function tomorrowForApp(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "tz");
  const timeZone = cookie ? decodeURIComponent(cookie.value) : "UTC";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

test("a wrong session cookie is sent to sign in like any stranger", async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: SESSION_COOKIE, value: "0".repeat(64), url: baseURL }]);
  await page.goto("/today");
  await expect(page).toHaveURL("/login?next=%2Ftoday");
});

test("the reset route answers 404 without the session", async ({ request }) => {
  expect((await request.post("/dev/e2e-session")).status()).toBe(404);
});

signedIn.describe("signed in", () => {
  // Each real route renders the whole app shell, and `next dev` on a busy runner can take most of the
  // default 30 seconds to answer one under the parallel suite. Warm, a route answers in well under a second.
  signedIn.describe.configure({ timeout: 90_000 });
  signedIn.use({ timezoneId: "UTC" });

  signedIn("G then a letter goes to a page, and a lone letter does not", async ({ page }) => {
    await page.goto("/today");
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.keyboard.press("i");
    await expect(page).toHaveURL("/today");
    await page.keyboard.press("g");
    await page.keyboard.press("i");
    await expect(page).toHaveURL("/inbox");
    await page.keyboard.press("g");
    await page.keyboard.press("l");
    await expect(page).toHaveURL("/lists");
  });

  for (const path of ["/day/2026-02-30", "/day/abc", "/day/1969-12-31"]) {
    signedIn(`${path} answers 404 with the not-found page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "There is nothing at this address." })).toBeVisible();
    });
  }

  for (const path of [
    "/tags/errands",
    "/tags/no-such-tag",
    "/notes/e2e00000-0000-4000-8000-000000000005",
    "/notes/e2e00000-0000-4000-8000-000000000999",
  ]) {
    signedIn(`${path} has one h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    });
  }

  for (const id of ["e2e00000-0000-4000-8000-000000000001", "e2e00000-0000-4000-8000-000000000999"]) {
    signedIn(`an open item (${id.slice(-3)}) sits in one Details landmark, not one inside another`, async ({ page }) => {
      await page.goto(`/tags/errands?item=${id}`);
      await expect(page.getByRole("complementary", { name: "Details" })).toBeVisible();
      await expect(page.getByRole("complementary")).toHaveCount(1);
    });
  }

  signedIn("a full day and week render with no React key or hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /unique "key"|Hydration/.test(m.text())) errors.push(`${page.url()}: ${m.text()}`);
    });
    const field = page.getByLabel("Capture anything");
    await page.goto("/today");
    for (let i = 0; i < 12; i++) {
      await field.fill(`Crowd ${i}${["", " 9:00", " tomorrow"][i % 3]}`);
      await field.press("Enter");
      await expect(field).toHaveValue("");
    }
    for (const path of ["/week", "/today", "/week"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });

  for (const path of ["/search?q=%00", "/notes?q=%00", "/search?q=a%00b"]) {
    signedIn(`${path} hydrates without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }

  signedIn("the landing page and /login send the account to Today", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/today");
    await page.goto("/login");
    await expect(page).toHaveURL("/today");
  });

  for (const [label, path, heading] of [
    ["Today", "/today", null],
    ["Week", "/week", null],
    ["Inbox", "/inbox", "Inbox"],
    ["Due", "/due", "Due"],
    ["Lists", "/lists", "Lists"],
    ["Tags", "/tags", "Tags"],
    ["Notes", "/notes", "Notes"],
    ["Search", "/search", "Search"],
    ["Settings", "/settings", "Settings"],
  ] as const) {
    signedIn(`the nav rail's ${label} link opens ${path}`, async ({ page }) => {
      await page.goto(path === "/inbox" ? "/lists" : "/inbox");
      const nav = page.getByRole("navigation", { name: "Primary" });
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1, ...(heading && { name: heading }) })).toBeVisible();
    });
  }

  signedIn("a task captured on Today waits in the Inbox, and planned for tomorrow it shows on that day", async ({ page }) => {
    const title = `Call the plumber ${Date.now()}`;
    await page.goto("/today");
    await page.getByLabel("Capture anything").fill(title);
    await page.getByLabel("Capture anything").press("Enter");
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto("/inbox");
    const list = page.getByRole("region", { name: "Waiting", exact: true });
    await list.getByRole("button", { name: `Plan for: ${title}` }).click();
    await list.getByRole("group", { name: `Plan ${title} for` }).getByRole("button", { name: "Tomorrow" }).click();
    // No assertion on the "is planned for" status: `next dev` compiles the action on its first call, and the
    // Fast Refresh rebuild that follows can reload the page and drop that message. The saved plan survives.
    await expect(list.getByRole("button", { name: `Plan for: ${title}` })).toHaveCount(0);

    await page.goto(`/day/${await tomorrowForApp(page)}`);
    await expect(page.getByText(title).first()).toBeVisible();
  });

  signedIn("one day of a series opens in the panel from Today, the List view and the Week", async ({ page }) => {
    const title = `Stretch ${Date.now()}`;
    const details = page.getByRole("complementary", { name: "Details" }).first();
    const chip = page.getByRole("button", { name: new RegExp(`^${title}\\s*, `) });
    const expectOccurrenceOpen = async () => {
      await expect(page).toHaveURL(/[?&]item=[0-9a-f-]{36}(~|%7E)\d{4}-\d{2}-\d{2}(&|$)/);
      await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue(title);
      await expect(details.getByText("This one", { exact: true })).toBeVisible();
      await expect(details.getByRole("button", { name: "Skip this one" })).toBeVisible();
    };

    await page.goto("/today");
    await page.getByLabel("Capture anything").fill(`${title} today`);
    await page.getByLabel("Capture anything").press("Enter");
    await chip.click();
    await details.getByLabel("Repeat").selectOption("daily");
    await expect(details.getByRole("status").filter({ hasText: /^Repeats every day/ })).toBeVisible();

    await page.goto("/today");
    await chip.click();
    await expectOccurrenceOpen();
    await page.reload();
    await expectOccurrenceOpen();

    await page.goto("/today?view=list");
    await chip.click();
    await expectOccurrenceOpen();

    await page.goto("/week");
    await chip.last().click();
    await expectOccurrenceOpen();
  });

  signedIn.describe("in New York", () => {
    signedIn.use({ timezoneId: "America/New_York" });
    signedIn.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "tz", value: encodeURIComponent("America/New_York"), url: baseURL }]);
    });

    const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
    const when = (page: Page) => details(page).locator("dt", { hasText: "When" }).locator("+ dd > span").first();

    async function timeOnDay(page: Page, day: string, title: string) {
      await page.goto("/today");
      await page.getByLabel("Capture anything").fill(`${title} ${day}`);
      await page.getByLabel("Capture anything").press("Enter");
      await expect(page.locator("#capture-status")).toContainText("Planned for");
      await page.goto(`/day/${day}`);
      await page.getByRole("button", { name: new RegExp(`^${title}\\s*, `) }).click();
      return details(page).getByRole("group", { name: "Time" });
    }

    async function typeTime(page: Page, time: Locator, start: string, end: string) {
      await time.getByLabel("Starts at").fill(start);
      await time.getByLabel("Ends at").fill(end);
      await time.getByLabel("Ends at").press("Enter");
    }

    signedIn("a typed end reads back as typed on both days the clocks change", async ({ page }) => {
      for (const [day, start, end] of [
        ["2026-03-08", "01:30", "04:00"],
        ["2026-11-01", "00:00", "23:59"],
      ]) {
        const time = await timeOnDay(page, day, `Night shift ${day} ${Date.now()}`);
        await typeTime(page, time, start, end);
        await expect(details(page).getByRole("status").filter({ hasText: `At ${start} now.` })).toBeVisible();
        await expect(when(page)).toHaveText(new RegExp(`, ${start} to ${end}$`));
        await page.reload();
        await expect(when(page)).toHaveText(new RegExp(`, ${start} to ${end}$`));
      }
    });

    signedIn("a start the clocks skip is refused, naming the first time that happens", async ({ page }) => {
      const time = await timeOnDay(page, "2026-03-08", `Early train ${Date.now()}`);
      await typeTime(page, time, "02:30", "03:30");
      await expect(
        details(page).getByRole("status").filter({ hasText: "02:30 does not happen on Sunday 8 March, when the clocks go forward. Try 03:00." }),
      ).toBeVisible();
      await page.reload();
      await expect(when(page)).toHaveText("Sunday 8 March");
    });
  });

  signedIn("Due groups dated items, and a tick marks one done", async ({ page }) => {
    await page.goto("/due");
    const past = page.getByRole("region", { name: "Earlier" });
    await expect(page.getByRole("heading", { level: 2, name: "Earlier" })).toHaveCSS("text-transform", "none");
    await expect(past.getByText("File the tax form")).toBeVisible();
    await expect(past.getByText("Was due Wednesday 15 January 2020")).toBeVisible();
    await expect(page.getByRole("region", { name: "Later" }).getByText("Renew the lease")).toBeVisible();
    await expect(page.getByText("Renew passport")).toHaveCount(0);

    // The box is drawn by a glyph over a visually hidden input, so it is ticked from the keyboard.
    await past.getByRole("checkbox", { name: "Done: File the tax form" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status")).toHaveText("File the tax form is done.");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Done: File the tax form" })).toBeChecked();
    await expect(page.getByText("Due Wednesday 15 January 2020")).toBeVisible();
  });

  signedIn("Today names what is left over from earlier days, and one can be moved to today", async ({ page }) => {
    await page.goto("/today");
    const strip = page.getByRole("region", { name: /earlier days? (is|are) still open/ });
    const row = strip.getByRole("button", { name: "Return the library books", exact: true });
    await expect(row).toBeVisible();
    await expect(strip.getByText("Planned Monday 3 February 2020")).toBeVisible();
    await strip.getByRole("button", { name: /^Move to today\s*: Return the library books$/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Return the library books is on today." })).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  signedIn("Lists and Tags show the account's checklist and tag", async ({ page }) => {
    const packing = page.getByRole("listitem").filter({ hasText: "Packing for Lisbon" });
    await page.goto("/lists");
    await expect(packing).toContainText("1 of 2 done");
    await page.reload();
    await expect(packing).toContainText("1 of 2 done");

    await page.goto("/tags");
    await page.getByRole("link", { name: /errands/ }).click();
    await expect(page).toHaveURL("/tags/errands");
    const passport = page.getByRole("checkbox", { name: "Done: Renew passport" });
    await expect(passport).not.toBeChecked();
    await page.reload();
    await expect(passport).not.toBeChecked();
  });

  signedIn("Density tightens the rows of a list, and is kept on reload", async ({ page }) => {
    const rowPadding = async () => {
      await page.goto("/lists");
      return page.getByRole("list").filter({ hasText: "Packing for Lisbon" }).getByRole("listitem").first().evaluate((el) => getComputedStyle(el).paddingTop);
    };
    expect(await rowPadding()).toBe("10px");

    await page.goto("/settings");
    await page.getByRole("button", { name: "Compact" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    expect(await rowPadding()).toBe("4px");
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");

    await page.goto("/settings");
    await page.getByRole("button", { name: "Spacious" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-density", "compact");
    expect(await rowPadding()).toBe("10px");
  });

  signedIn("Settings names the account and exports its data", async ({ page, request }) => {
    await page.goto("/settings");
    await expect(page.getByText("Signed in as e2e@axiis.invalid")).toBeVisible();

    const exported = await request.get("/settings/export", { headers: sessionHeader() });
    expect(exported.status()).toBe(200);
    const body = await exported.json();
    expect(body.user.email).toBe("e2e@axiis.invalid");
    expect(body.areas.map((a: { name: string }) => a.name)).toEqual(["Work", "Home", "Health"]);
    expect(body.items.map((i: { title: string }) => i.title)).toContain("Packing for Lisbon");
  });

  signedIn("signing out returns to sign in and ends the session", async ({ page }) => {
    await page.goto("/today");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/today");
    await expect(page).toHaveURL("/login?next=%2Ftoday");
  });

  for (const path of ["/today", "/inbox", "/due", "/settings"]) {
    signedIn(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ rule: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")) }));
      expect(blocking).toEqual([]);
    });
  }
});
