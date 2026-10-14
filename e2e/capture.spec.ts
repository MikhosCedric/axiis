import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const field = (page: Page) => page.locator("#capture");
const status = (page: Page) => page.locator("#capture-status");

async function capture(page: Page, text: string) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

test.describe("capture field", () => {
  test("Today: a plain capture says it is waiting below and rings the new chip", async ({ page }) => {
    await page.goto("/dev/score");
    await capture(page, "Water the ferns");
    await expect(field(page)).toHaveValue("");
    await expect(status(page)).toHaveText("Captured. It is waiting for a time, below.");
    await expect(page.locator("[data-captured]")).toContainText("Water the ferns");
    await expect(page.locator("[data-captured]")).toHaveCount(0, { timeout: 5_000 });
  });

  test("Today: the words plan a timed slot, previewed first, then said back", async ({ page }) => {
    await page.goto("/dev/score");
    await field(page).fill("stretch today at 10:00 #health");
    await expect(page.locator("#capture-preview")).toHaveText("Understood: today, 10:00, #health");
    await field(page).press("Enter");
    await expect(status(page)).toHaveText("Planned for today, 10:00, with #health.");
    await expect(page.locator("[data-captured]")).toContainText("stretch");
  });

  test("Today: a plan for tomorrow leaves today's screen and says where it went", async ({ page }) => {
    await page.goto("/dev/score");
    await capture(page, "dentist tomorrow 9:00");
    await expect(status(page)).toHaveText("Planned for tomorrow, 09:00.");
    await expect(page.getByText("dentist", { exact: true })).toHaveCount(0);
  });

  test("words that only look like a plan stay in the title", async ({ page }) => {
    await page.goto("/dev/score");
    await field(page).fill("Read chapter 9");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).fill("Groceries for Sunday");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).fill("Groceries by Sunday");
    await expect(page.locator("#capture-preview")).toHaveText("Understood: Sunday");
    await field(page).fill("call \\friday");
    await expect(page.locator("#capture-preview")).toHaveCount(0);
    await field(page).press("Enter");
    await expect(page.locator("[data-captured]")).toContainText("call friday");
  });

  test("the Guide explains the words, and Escape closes it back onto its button", async ({ page }) => {
    await page.goto("/dev/score");
    const button = page.getByRole("button", { name: "Guide" });
    await button.click();
    const guide = page.getByRole("dialog", { name: "Guide" });
    await expect(guide.getByRole("heading", { name: "Capture words" })).toBeVisible();
    await expect(guide).toContainText("dentist tomorrow 9:00 #health");
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("Week: a capture rings its chip in the tray", async ({ page }) => {
    await page.goto("/dev/week");
    await capture(page, "Sort the receipts");
    await expect(status(page)).toHaveText("Captured. It is waiting for a time, below.");
    await expect(page.locator("[data-captured]")).toContainText("Sort the receipts");
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
    await expect(page.getByRole("button", { name: "Guide" })).toHaveCount(0);
    await field(page).press("Enter");
    await expect(status(page)).toHaveText("Captured. It is open, ready for its lines.");
    const details = page.getByRole("complementary", { name: "Details" });
    await expect(details.getByRole("textbox", { name: "Title" })).toHaveValue("Pack for the city tomorrow #trip");
  });

  test("a failed capture keeps the words and says so", async ({ page }) => {
    await page.goto("/dev/score");
    await page.getByLabel("Make saves fail").check();
    await capture(page, "Call the landlord tomorrow");
    await expect(field(page)).toHaveValue("Call the landlord tomorrow");
    await expect(status(page)).toContainText("did not save");
  });
});

test.describe("palette actions", () => {
  async function openPalette(page: Page) {
    await expect(page.getByRole("heading", { name: "Palette harness" })).toBeVisible();
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
