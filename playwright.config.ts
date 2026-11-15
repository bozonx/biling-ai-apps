import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: [
    {
      command: "pnpm --filter @billing/web dev --host 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @billing/api dev",
      env: {
        DATABASE_URL: "postgresql://billing:billing@localhost:5432/billing",
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
        API_PORT: "3001",
      },
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
