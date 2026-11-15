import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import { Database } from "../../apps/api/src/database.js";
import { WalletService } from "../../apps/api/src/wallet.js";

test("wallet transactions serialize reservations and preserve an append-only ledger", async () => {
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = postgres.getConnectionUri();
  const db = new Database();
  try {
    execFileSync("pnpm", ["db:deploy"], { env: process.env });
    const service = new WalletService(db);
    const product = await db.product.create({
      data: { code: "wallet-test", name: "Test" },
    });
    const identity = await db.identity.create({ data: {} });
    const account = await db.billingAccount.create({
      data: { ownerIdentityId: identity.id, personalOwnerId: identity.id },
    });
    const rate = await db.creditRateVersion.create({
      data: {
        productId: product.id,
        version: 1,
        creditValueMicros: 10000n,
        effectiveFrom: new Date(),
        publishedAt: new Date(),
      },
    });
    const feature = await db.productFeature.create({
      data: { productId: product.id, key: "test", pricing: "fixed" },
    });
    const input = {
      accountId: account.id,
      amountMilli: "1000",
      creditRateVersionId: rate.id,
    };
    const grant = await service.grant(product.id, "grant-1", input);
    expect((await service.grant(product.id, "grant-1", input)).id).toBe(
      grant.id,
    );
    await expect(
      service.grant(product.id, "grant-1", { ...input, amountMilli: "2000" }),
    ).rejects.toThrow();
    const results = await Promise.allSettled(
      ["a", "b"].map((key) =>
        service.reserve(product.id, key, {
          accountId: account.id,
          featureId: feature.id,
          amountMilli: "700",
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const success = results.find((result) => result.status === "fulfilled");
    if (!success || success.status !== "fulfilled")
      throw new Error("Missing reservation");
    const hold = success.value;
    await Promise.all([
      service.close(product.id, hold.id, "commit"),
      service.close(product.id, hold.id, "commit"),
    ]);
    expect(await service.balance(account.id, product.id)).toMatchObject({
      balanceMilli: 300n,
      heldMilli: 0n,
    });
    expect(await db.creditLedgerEntry.count()).toBe(2);
    expect(
      (await db.creditLedgerEntry.aggregate({ _sum: { amountMilli: true } }))
        ._sum.amountMilli,
    ).toBe(300n);
    const released = await service.reserve(product.id, "release", {
      accountId: account.id,
      featureId: feature.id,
      amountMilli: "200",
    });
    await service.close(product.id, released.id, "release");
    await service.close(product.id, released.id, "release");
    await expect(
      service.close(product.id, released.id, "commit"),
    ).rejects.toThrow();
    expect(await service.balance(account.id, product.id)).toMatchObject({
      balanceMilli: 300n,
      heldMilli: 0n,
    });
  } finally {
    await db.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await postgres.stop();
  }
}, 120000);
