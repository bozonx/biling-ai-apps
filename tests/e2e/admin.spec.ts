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
