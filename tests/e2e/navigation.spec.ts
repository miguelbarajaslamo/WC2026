import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("main mobile routes render", async ({ page }) => {
  for (const path of ["/", "/fixtures", "/leaderboard", "/picks", "/groups", "/stats", "/pool", "/settings", "/admin", "/onboarding"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("WORLD CUP PICKS").first()).toBeVisible();
  }
});

test("picks can be made inline from zero-zero", async ({ page }) => {
  await page.goto("/picks", { waitUntil: "domcontentloaded" });
  test.skip(
    await page.getByRole("heading", { name: "Sign in" }).isVisible(),
    "Auth proxy redirected to login; inline picks need an authenticated pool session.",
  );
  await expect(page.getByRole("button", { name: /Missing/ }).first()).toBeVisible();
  await expect(page.getByText("0-0").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save pick" }).first()).toBeVisible();
});
