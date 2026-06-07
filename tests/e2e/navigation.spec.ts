import { expect, test } from "@playwright/test";

test("main mobile routes render", async ({ page }) => {
  for (const path of ["/", "/fixtures", "/leaderboard", "/picks", "/groups", "/pool", "/settings", "/admin", "/onboarding"]) {
    await page.goto(path);
    await expect(page.getByText("WORLD CUP PICKS").first()).toBeVisible();
  }
});

test("picks can be made inline from zero-zero", async ({ page }) => {
  await page.goto("/picks");
  await expect(page.getByText("Missing picks").first()).toBeVisible();
  await expect(page.getByText("0-0").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save pick" }).first()).toBeVisible();
});
