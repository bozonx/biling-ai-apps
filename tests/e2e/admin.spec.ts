import { test, expect } from "@playwright/test";

test("staff catalog opens independently of the dev account and clears the token on disconnect", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/catalog", async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer test-staff-token",
    );
    await route.fulfill({
      json: {
        products: [
          {
            id: "test-product",
            code: "test",
            name: "Test product",
            status: "active",
          },
        ],
        features: [],
        prices: [],
        rates: [],
        plans: [],
        versions: [],
        keys: [],
      },
    });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Администрирование" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Загрузить" })).toBeDisabled();
  await page.getByLabel("Токен staff").fill("test-staff-token");
  await page.getByRole("button", { name: "Загрузить" }).click();
  await expect(
    page.getByRole("cell", { name: "Test product", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Выполнить" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page.getByLabel("Токен staff")).toHaveValue("");
  await expect(
    page.getByRole("cell", { name: "Test product", exact: true }),
  ).toHaveCount(0);
});

test("persists staff session on reload and supports sidebar navigation with settings", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/catalog", async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer persisted-token",
    );
    await route.fulfill({
      json: {
        products: [
          {
            id: "prod-1",
            code: "tyco",
            name: "TyCo Product",
            status: "active",
          },
        ],
        features: [
          {
            id: "feat-1",
            productId: "prod-1",
            key: "chat",
            pricing: "metered",
            status: "active",
          },
        ],
        prices: [],
        rates: [],
        plans: [],
        versions: [],
        keys: [],
      },
    });
  });

  await page.goto("/admin");
  await page.getByLabel("Токен staff").fill("persisted-token");
  await page.getByRole("button", { name: "Загрузить" }).click();

  // The login form is no longer visible once authenticated
  await expect(page.getByLabel("Токен staff")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "TyCo Product", exact: true }),
  ).toBeVisible();

  // Reload the page: session should persist and login form should not show up
  await page.reload();
  await expect(page.getByLabel("Токен staff")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "TyCo Product", exact: true }),
  ).toBeVisible();

  // Sidebar navigation to separate pages
  await page.getByRole("link", { name: "Цены и функции" }).click();
  await expect(page).toHaveURL(/\/admin\/pricing$/);
  await expect(
    page.getByRole("cell", { name: "chat", exact: true }),
  ).toBeVisible();

  // Navigate to Settings via sidebar
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Настройки" })
    .click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(
    page.getByRole("heading", {
      name: "Настройки администратора",
      exact: true,
    }),
  ).toBeVisible();

  // Sign out from settings page
  await page.getByRole("button", { name: "Выйти" }).first().click();
  await expect(page.getByLabel("Токен staff")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("billing.adminToken")),
  ).toBeNull();
});
