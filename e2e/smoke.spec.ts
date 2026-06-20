import { test, expect } from "@playwright/test";

test("overview dashboard renders seeded profitability data", async ({ page }) => {
  await page.goto("/");

  // Page header
  await expect(
    page.getByRole("heading", { name: "Profitability Overview" }),
  ).toBeVisible();

  // Stat cards (labels unique to the overview cards)
  await expect(page.getByText("Revenue (today)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily Operating Profit" })).toBeVisible();

  // Charts rendered (inline SVG)
  await expect(
    page.getByRole("img", { name: "Daily operating profit over time" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Profit waterfall" })).toBeVisible();

  // Business-unit table shows at least one seeded unit
  await expect(
    page.getByRole("heading", { name: "Profitability by Business Unit" }),
  ).toBeVisible();
  await expect(page.getByText("Precision Machining")).toBeVisible();
});

test("drill-down page loads and recomputes", async ({ page }) => {
  await page.goto("/drill-down");
  await expect(page.getByRole("heading", { name: "Drill-down" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily Breakdown" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Profit waterfall" }),
  ).toBeVisible();
});
