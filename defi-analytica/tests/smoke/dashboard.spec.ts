import { expect, test } from "@playwright/test";

test("dashboard page renders demo KPI shell", async ({ page }) => {
  await page.goto("/dashboard?mode=demo");

  await expect(page.getByRole("heading", { name: "Dashboard KPI Cards" })).toBeVisible();
  await expect(page.getByText("Composite Score")).toBeVisible();
  await expect(page.getByText("Sentiment State Panel")).toBeVisible();
});

test("sentiment deep dive renders demo analytics", async ({ page }) => {
  await page.goto("/dashboard/sentiment?mode=demo");

  await expect(page.getByRole("heading", { name: "Sentiment Deep Dive" })).toBeVisible();
  await expect(page.getByText("Recent Sentiment Observations")).toBeVisible();
  await expect(page.getByText("Confidence Trend").first()).toBeVisible();
});

test("flows page renders demo charts and export actions", async ({ page }) => {
  await page.goto("/dashboard/flows?mode=demo&chain=Ethereum");

  await expect(page.getByRole("heading", { name: "Flows Deep Dive" })).toBeVisible();
  await expect(page.getByText("Export Actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByText("Feature 14 Complete")).toBeVisible();
});
