import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:3012", locale: "ru-RU" },
  webServer: {
    command: "pnpm --filter @billing/web dev --host 127.0.0.1",
    url: "http://127.0.0.1:3012",
    reuseExistingServer: !process.env.CI,
  },
});
