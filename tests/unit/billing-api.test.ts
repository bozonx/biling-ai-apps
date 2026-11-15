import { createHash } from "node:crypto";
import { BillingController } from "../../apps/api/src/billing-controller.js";
import type { Database } from "../../apps/api/src/database.js";
import type { WalletService } from "../../apps/api/src/wallet.js";

test("S2S rejects missing keys and scopes and derives product exclusively from the key", async () => {
  let key: unknown;
  let lookupArgs: unknown;
  const lookup = async (args: unknown) => {
    lookupArgs = args;
    return key;
  };
  const calls: unknown[][] = [];
  const balance = async (...args: unknown[]) => {
    calls.push(args);
    return { balanceMilli: 123n };
  };
  const controller = new BillingController(
    { productApiKey: { findUnique: lookup } } as unknown as Database,
    { balance } as unknown as WalletService,
  );
  const accountId = "019a85e0-1111-7111-8111-111111111111";
  await expect(controller.balance(undefined, accountId)).rejects.toThrow();
  key = {
    productId: "product",
    scopes: [],
    status: "active",
    revokedAt: null,
    product: { status: "active" },
  };
  await expect(
    controller.balance("Bearer secret", accountId),
  ).rejects.toThrow();
  expect(calls).toHaveLength(0);
  key = {
    productId: "product",
    scopes: ["wallets:read"],
    status: "active",
    revokedAt: null,
    product: { status: "active" },
  };
  expect(await controller.balance("Bearer secret", accountId)).toEqual({
    balanceMilli: "123",
  });
  expect(calls).toEqual([[accountId, "product"]]);
  expect(lookupArgs).toEqual({
    where: { keyHash: createHash("sha256").update("secret").digest("hex") },
    include: { product: true },
  });
});
