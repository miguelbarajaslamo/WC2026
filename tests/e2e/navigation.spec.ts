import { expect, test } from "@playwright/test";

test("main mobile routes render", async ({ page }) => {
  for (const path of ["/", "/fixtures", "/leaderboard", "/picks", "/groups", "/pool", "/settings", "/admin"]) {
    await page.goto(path);
    await expect(page.getByText("WORLD CUP PICKS").first()).toBeVisible();
  }
});
