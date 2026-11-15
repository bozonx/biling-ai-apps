import { DevAccountController } from "../../apps/api/src/dev-account.js";
import type { WalletService } from "../../apps/api/src/wallet.js";

test("development account is disabled by default and always disabled in production", () => {
  const previous = { ...process.env };
  try {
    const controller = new DevAccountController({} as WalletService);
    delete process.env.DEV_ACCOUNT_ENABLED;
    expect(() => controller.account()).toThrow();
    process.env.DEV_ACCOUNT_ENABLED = "true";
    process.env.NODE_ENV = "production";
    expect(() => controller.account()).toThrow();
    process.env.NODE_ENV = "test";
    process.env.DEV_ACCOUNT_ID = "019a85e0-1111-7111-8111-111111111111";
    process.env.DEV_PRODUCT_ID = "019a85e0-1111-7111-8111-111111111112";
    expect(controller.account().accountId).toBe(process.env.DEV_ACCOUNT_ID);
  } finally {
    process.env = previous;
  }
});
