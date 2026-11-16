import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hydrated, signedIn } from "./session";

const field = (page: Page) => page.locator("#capture");
const status = (page: Page) => page.locator("#capture-status");

async function capture(page: Page, text: string) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

test.describe("capture field", () => {
  test("Today: a plain capture says it is waiting below and rings the new chip", async ({ page }) => {
    await page.goto("/dev/day");
    await capture(page, "Water the ferns");
    await expect(field(page)).toHaveValue("");
    await expect(status(page)).toHaveText("Captured. It is in the Inbox, below.");
    await expect(page.locator("[data-captured]")).toContainText("Water the ferns");
    await expect(page.locator("[data-captured]")).toHaveCount(0, { timeout: 5_000 });
  });

  test("Today: the words plan a timed slot, previewed first, then said back", async ({ page }) => {
    await page.goto("/dev/day");
    await field(page).fill("stretch today at 10:00 #health");
    await expect(page.locator("#capture-preview")).toHaveText("Understood: today, 10:00, #health");
    await field(page).press("Enter");
    await expect(status(page)).toHaveText("Planned for today, 10:00, with #health.");
    await expect(page.locator("[data-captured]")).toContainText("stretch");
  });

  test("Today: a repeating plan is previewed and saved as a series in one step", async ({ page }) => {
    await page.goto("/dev/day");
    await field(page).fill("every tuesday at 7:30am to 9am gym");
    // Once 07:30 has passed on a Tuesday, the series starts next week and the preview says so.
    await expect(page.locator("#capture-preview")).toHaveText(/^Understood: Every Tuesday( starting Tuesday \d+ \w+)?, 07:30 to 09:00$/);
    await field(page).press("Enter");
    await expect(status(page)).toHaveText(/^Starts (today|tomorrow|Tuesday \d+ \w+), 07:30 to 09:00\. Repeats every Tuesday\.$/);
  });

  test("Today: a plan for tomorrow leaves today's screen and says where it went", async ({ page }) => {
    await page.goto("/dev/day");
    await capture(page, "dentist tomorrow 9:00");
    await expect(status(page)).toHaveText("Planned for tomorrow, 09:00.");
    await expect(page.getByText("dentist", { exact: true })).toHaveCount(0);
  });

  test("words that only look like a plan stay in the title", async ({ page }) => {
    await page.goto("/dev/day");
    await field(page).fill("Read chapter 9");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).fill("Plan for Monday's meeting");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).fill("Groceries by Sunday");
    await expect(page.locator("#capture-preview")).toHaveText("Understood: Sunday");
    await field(page).fill("call \\friday");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).press("Enter");
    await expect(page.locator("[data-captured]")).toContainText("call friday");
  });

  test("the preview says what a new phrase was understood as, and drops the preposition from the title", async ({ page }) => {
    await page.goto("/dev/day");
    const preview = page.locator("#capture-preview");
    await field(page).fill("Groceries for Sunday");
    await expect(preview).toHaveText("Understood: Sunday");
    await field(page).fill("gym 7pm 1h");
    await expect(preview).toHaveText("Understood: today, 19:00 to 20:00");
    await field(page).fill("call Sam in 2 hours");
    await expect(preview).toHaveText(/^Understood: (today|tomorrow), \d\d:\d\d$/);
    await field(page).fill("write report due friday");
    await expect(preview).toHaveText("Understood: due Friday");
    await field(page).fill("file expenses @nowhere");
    await expect(preview).toHaveText("Understood: No area named “nowhere”, so it stays in the title");
    await field(page).fill("next week review");
    await expect(preview).toHaveText(/^Understood: \w+ \d+ \w+( \d{4})?$/);
  });

  test("a pasted block offers items or a checklist and does not force either", async ({ page }) => {
    await page.goto("/dev/day");
    await hydrated(page);
    const paste = (text: string) =>
      field(page).evaluate((el, value) => {
        const data = new DataTransfer();
        data.setData("text", value);
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      }, text);
    await field(page).focus();
    await paste("Milk\nEggs\nBread");
    const offer = page.getByRole("group", { name: "You pasted 3 lines." });
    await expect(offer).toBeVisible();
    await expect(offer.getByRole("button", { name: "Add 3 items" })).toBeVisible();
    await expect(offer.getByRole("button", { name: "Add as a checklist named “Milk”" })).toBeVisible();
    // Typing withdraws the offer; nothing was saved.
    await field(page).press("x");
    await expect(offer).toHaveCount(0);
    await field(page).fill("");
    await paste("Milk\nEggs\nBread");
    await page.getByRole("button", { name: "Add 3 items" }).click();
    await expect(field(page)).toHaveValue("");
    await expect(page.getByText("Bread", { exact: true }).first()).toBeVisible();
  });

  test("the Guide explains the words, and Escape closes it back onto its button", async ({ page }) => {
    await page.goto("/dev/day");
    const button = page.getByRole("button", { name: "Guide" });
    await button.click();
    const guide = page.getByRole("dialog", { name: "Guide" });
    await expect(guide.getByRole("heading", { name: "Capture words" })).toBeVisible();
    await expect(guide).toContainText("dentist tomorrow 9:00 #health");
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("Inbox: a capture rings its row", async ({ page }) => {
    await page.goto("/dev/inbox");
    await capture(page, "Return the library books");
    await expect(page.locator("[data-captured]")).toHaveText(/Return the library books/);
  });

  test("Lists: a checklist keeps its name as typed, with no preview or syntax help", async ({ page }) => {
    await page.goto("/dev/lists?empty");
    await field(page).fill("Pack for the city tomorrow #trip");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    // Every page has the Guide at the end of its title row; here it has no capture words to explain.
    await expect(page.getByRole("button", { name: "Guide" })).toHaveCount(1);
    await field(page).press("Enter");
    await expect(status(page)).toHaveText("Captured. It is open, ready for its lines.");
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Pack for the city tomorrow #trip");
  });

  test("a failed capture keeps the words and says so", async ({ page }) => {
    await page.goto("/dev/day");
    await page.getByLabel("Make saves fail").check();
    await capture(page, "Call the landlord tomorrow");
    await expect(field(page)).toHaveValue("Call the landlord tomorrow");
    await expect(status(page)).toContainText("did not save");
  });
});

test.describe("palette actions", () => {
  async function openPalette(page: Page) {
    // The shortcut is a listener React attaches on hydration; the server-drawn heading shows before that.
    await hydrated(page);
    await page.keyboard.press("Control+k");
    const box = page.getByRole("combobox");
    await expect(box).toBeFocused();
    return box;
  }

  test("a found item lists its actions; done, a tag and a plan save, and Escape steps back", async ({ page }) => {
    await page.goto("/dev/palette");
    const box = await openPalette(page);
    await box.fill("lisbon trip");
    const option = page.getByRole("option", { name: "Plan the Lisbon trip, Task" });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByRole("group", { name: "Actions for “Plan the Lisbon trip”" })).toBeVisible();
    await expect(page.getByRole("option")).toHaveText(["Open", "Mark done", "Plan for today", "Plan for tomorrow", "Add a tag"]);
    await expect(box).toBeFocused();

    await box.fill("done");
    await box.press("Enter");
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("“Plan the Lisbon trip” is done.");
    await expect(page.getByRole("option", { name: "Mark open again" })).toBeVisible();

    await box.fill("add");
    await box.press("Enter");
    await expect(box).toHaveValue("#");
    await box.pressSequentially("travel");
    await expect(page.getByRole("option")).toHaveText(["Tag #travel"]);
    await box.press("Enter");
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("“Plan the Lisbon trip” is tagged #travel.");

    await box.fill("tomorrow");
    await box.press("Enter");
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("“Plan the Lisbon trip” is planned for tomorrow.");

    await box.press("Escape");
    await expect(box).toHaveValue("lisbon trip");
    await expect(page.getByRole("option", { name: "Plan the Lisbon trip, Task, done" })).toBeVisible();
    await box.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the selected item comes first, without an Open action, and a note only offers a tag", async ({ page }) => {
    await page.goto("/dev/palette?item=00000000-0000-4000-8000-000000000001");
    const box = await openPalette(page);
    const first = page.getByRole("option").first();
    await expect(first).toHaveAccessibleName("Plan the Lisbon trip, Task");
    await expect(page.getByRole("group", { name: "Selected" })).toBeVisible();
    await box.press("Enter");
    await expect(page.getByRole("option")).toHaveText(["Mark done", "Plan for today", "Plan for tomorrow", "Add a tag"]);
    await box.press("Backspace");
    await expect(page.getByRole("group", { name: "Selected" })).toBeVisible();

    await box.fill("garden");
    await page.getByRole("option", { name: "Garden through the winter, Note" }).click();
    await expect(page.getByRole("option")).toHaveText(["Open", "Add a tag"]);
  });

  test("the palette says what a capture will understand, then what it did", async ({ page }) => {
    await page.goto("/dev/palette");
    const box = await openPalette(page);
    await box.fill("dentist tomorrow 9:00");
    const offer = page.getByRole("option", { name: "Capture “dentist” as a task: tomorrow, 09:00" });
    await expect(offer).toBeVisible();
    await offer.click();
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Captured “dentist”. Planned for tomorrow, 09:00.");
  });

  test("Enter on an item's exact name opens that item instead of capturing a copy", async ({ page }) => {
    await page.goto("/dev/palette");
    const box = await openPalette(page);
    // Enter at once, before the search has answered: it waits for it rather than saving a second one.
    await box.fill("plan the lisbon trip");
    await box.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("status")).toHaveText("“Plan the Lisbon trip” is already here, so Enter opens it. Choose Capture to add another.");
    await expect(page.getByRole("option").first()).toHaveAccessibleName("Plan the Lisbon trip, Task");
    await expect(page.getByRole("option", { name: "Capture “plan the lisbon trip” as a new task" })).toBeVisible();
    await box.press("Enter");
    await expect(page.getByRole("option")).toHaveText(["Open", "Mark done", "Plan for today", "Plan for tomorrow", "Add a tag"]);
  });

  test("the actions list has no serious axe violations", async ({ page }) => {
    await page.goto("/dev/palette");
    const box = await openPalette(page);
    await box.fill("lisbon trip");
    await page.getByRole("option", { name: "Plan the Lisbon trip, Task" }).click();
    await expect(page.getByRole("option", { name: "Mark done" })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

signedIn("Week: a capture rings its chip in the tray", async ({ page }) => {
  await page.goto("/week");
  await hydrated(page);
  await capture(page, "Sort the receipts");
  await expect(status(page)).toHaveText("Captured. It is in the Inbox, below.");
  await expect(page.locator("[data-captured]")).toContainText("Sort the receipts");
});
