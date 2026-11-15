import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:3014", locale: "ru-RU" },
  webServer: {
    command:
      "pnpm --filter @billing/web build && node apps/web/.output/server/index.mjs",
    env: { NITRO_PORT: "3014", NITRO_HOST: "127.0.0.1" },
    url: "http://127.0.0.1:3014",
    timeout: 180000,
  },
});
