import { expect, test } from "@playwright/test";

test("Pot of Glory starts and renders its climb controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("orange_bbq_player_name", "Mountain Audit");
    localStorage.setItem("orange_bbq_climb_tutorial_v1", "1");
  });
  page.on("dialog", (dialog) => dialog.accept("Mountain Audit"));

  await page.goto("/game", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Pot of Glory/i }).click();

  const tutorialButton = page.getByRole("button", { name: /GOT IT/i });
  if (await tutorialButton.isVisible().catch(() => false)) {
    await tutorialButton.click();
  }

  const canvas = page.getByRole("img", {
    name: /Pot of Glory/i,
  }).or(page.locator('canvas[aria-label^="Pot of Glory"]'));
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/MOVE FROM CENTER TO SWING/i)).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(300);
  expect(box?.height).toBeGreaterThan(300);

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.35, {
      steps: 8,
    });
    await page.waitForTimeout(500);
    await page.mouse.up();
  }
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});
