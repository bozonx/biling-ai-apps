import { test, expect } from "@playwright/test";
test("portal and API are available", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Billing AI" })).toBeVisible();
  const response = await request.get("http://127.0.0.1:3001/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok", service: "api" });
});
