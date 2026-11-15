import { test, expect } from "@playwright/test";

const account = {
  accountId: "11111111-1111-4111-8111-111111111111",
  productId: "22222222-2222-4222-8222-222222222222",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("billing.signInMethod", "dev");
  });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: account }));
  await page.route("**/api/v1/me/wallet", (route) =>
    route.fulfill({
      json: {
        ...account,
        balanceMilli: "1000",
        heldMilli: "0",
        debtMilli: "0",
      },
    }),
  );
  await page.route("**/api/v1/me/operations", (route) =>
    route.fulfill({ json: [] }),
  );
});

test("restores session and displays empty operations", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Обзор", exact: true }),
  ).toBeVisible();
  await page.goto("/operations");
  await expect(
    page.getByText("Операций пока нет", { exact: true }),
  ).toBeVisible();
});

test("persists theme and language", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: "Тёмная", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Язык интерфейса" }).click();
  await page.getByRole("menuitemcheckbox", { name: "English (US)" }).click();
  await expect(
    page.getByRole("heading", { name: "Appearance", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("heading", { name: "Appearance", exact: true }),
  ).toBeVisible();
});

test("retries session restoration after a temporary failure", async ({
  page,
}) => {
  let unavailable = true;
  await page.route("**/api/v1/me", (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: account }),
  );
  await page.goto("/operations");
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("billing.signInMethod")),
  ).toBe("dev");
  unavailable = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page).toHaveURL(/\/operations$/);
});

test("clears session on unauthorized response", async ({ page }) => {
  await page.route("**/api/v1/me/operations", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/operations");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("billing.signInMethod")),
  ).toBeNull();
});

test("opens and closes mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Операции", exact: true })
    .click();
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
