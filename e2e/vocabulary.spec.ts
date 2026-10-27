import { expect, test } from "@playwright/test";

test("the Score prints a key to its line forms and the now line, the Week to its line forms", async ({ page }) => {
  await page.goto("/dev/score");
  await expect(page.getByRole("list", { name: "Key" }).getByRole("listitem")).toHaveText([
    "Planned",
    "Happening",
    "Done",
    "Now",
  ]);
  await page.goto("/dev/week");
  await expect(page.getByRole("list", { name: "Key" }).getByRole("listitem")).toHaveText(["Planned", "Happening", "Done"]);
});

test("a tag page's glyph ticks an item done and back, and a series or a note has no tick", async ({ page }) => {
  await page.goto("/dev/tags/errands");
  const tick = page.getByRole("checkbox", { name: "Done: Renew passport" });
  // The box is drawn by a glyph over a visually hidden input, so it is ticked from the keyboard.
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: "Renew passport" })).toHaveText("Renew passport is done.");
  await expect(page.getByRole("button", { name: /^Renew passport\s*, done$/ })).toBeVisible();
  await expect(tick).toBeChecked();

  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: "Renew passport" })).toHaveText("Renew passport is open again.");
  await expect(tick).not.toBeChecked();

  await expect(page.getByRole("checkbox", { name: /Water the ferns/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Shops that still take cash/ })).toHaveCount(0);
});

test("a checklist's glyph on Lists ticks it done, and a repeating one has no tick", async ({ page }) => {
  await page.goto("/dev/lists");
  await page.getByRole("checkbox", { name: "Done: Pack for the coast" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: "is done" })).toHaveText("Pack for the coast is done.");
  await expect(page.getByRole("button", { name: /^Pack for the coast\s*, done$/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Weekly reset/ })).toHaveCount(0);
});

test("a failed tick on a tag page puts the item back and says so", async ({ page }) => {
  await page.goto("/dev/tags/errands");
  await page.getByLabel("Make every save fail").check();
  const tick = page.getByRole("checkbox", { name: "Done: Renew passport" });
  await tick.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toHaveText("That change did not save. Try again.");
  await expect(tick).not.toBeChecked();
});
