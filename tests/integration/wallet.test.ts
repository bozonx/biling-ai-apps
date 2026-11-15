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
    await expect(
      service.grant(product.id, "too-large", {
        ...input,
        amountMilli: "9223372036854775807",
      }),
    ).rejects.toThrow();
    const expiring = await service.reserve(product.id, "expires", {
      accountId: account.id,
      featureId: feature.id,
      amountMilli: "100",
    });
    await db.creditHold.update({
      where: { id: expiring.id },
      data: { expiresAt: new Date(0) },
    });
    await service.expireHolds();
    expect((await service.balance(account.id, product.id)).heldMilli).toBe(0n);
    expect(
      await db.creditHold.findUnique({ where: { id: expiring.id } }),
    ).toMatchObject({ status: "expired" });
    await service.expireHolds();
    expect(await service.history(account.id, product.id)).toHaveLength(1);
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
    expect(await db.usageEvent.count()).toBe(1);
    expect(await db.usageEventKey.count()).toBe(1);
    const usage = await db.usageEvent.findFirstOrThrow();
    expect(usage.creditsChargedMilli).toBe(700n);
    expect(
      await db.creditLedgerEntry.findFirst({
        where: { reason: "consumption" },
      }),
    ).toMatchObject({ usageEventId: usage.id });

    expect(
      (await db.creditLedgerEntry.aggregate({ _sum: { amountMilli: true } }))
        ._sum.amountMilli,
    ).toBe(300n);
    await db.productEntitlementKey.create({
      data: {
        productId: product.id,
        key: "ai.enabled",
        type: "bool",
        merge: "or",
        enumValues: [],
      },
    });
    await db.productFeature.update({
      where: { id: feature.id },
      data: { requires: { "ai.enabled": true } },
    });
    await expect(
      service.reserve(product.id, "denied", {
        accountId: account.id,
        featureId: feature.id,
        amountMilli: "100",
      }),
    ).rejects.toThrow();
    const plan = await db.plan.create({
      data: {
        code: "entitlement-test",
        name: "Test",
        kind: "base",
        productScope: [product.code],
      },
    });
    await db.planVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        effectiveFrom: new Date(),
        publishedAt: new Date(),
        entitlements: { [product.code]: { "ai.enabled": true } },
      },
    });
    await db.planGrant.create({
      data: {
        accountId: account.id,
        productId: product.id,
        planId: plan.id,
        source: "default",
        startsAt: new Date(),
        idempotencyKey: "test-grant",
      },
    });
    expect(await service.entitlements(account.id, product.id)).toEqual({
      "ai.enabled": true,
    });
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
    const stale = await service.reserve(product.id, "stale-bucket", {
      accountId: account.id,
      featureId: feature.id,
      amountMilli: "100",
    });
    await db.creditBucket.updateMany({
      where: { accountId: account.id, productId: product.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      service.close(product.id, stale.id, "commit"),
    ).rejects.toMatchObject({
      response: { code: "CREDITS_EXPIRED" },
    });
    await service.close(product.id, stale.id, "release");
    await expect(
      service.reserve(product.id, "expired-balance", {
        accountId: account.id,
        featureId: feature.id,
        amountMilli: "100",
      }),
    ).rejects.toMatchObject({ response: { code: "INSUFFICIENT_CREDITS" } });
    expect(await service.balance(account.id, product.id)).toMatchObject({
      balanceMilli: 0n,
      heldMilli: 0n,
      nextExpiryAt: null,
    });
    expect(await db.creditOperation.count({ where: { kind: "expiry" } })).toBe(
      1,
    );
    await service.balance(account.id, product.id);
    expect(await db.creditOperation.count({ where: { kind: "expiry" } })).toBe(
      1,
    );
    expect(
      (await db.creditLedgerEntry.aggregate({ _sum: { amountMilli: true } }))
        ._sum.amountMilli,
    ).toBe(0n);
    const indebted = await db.creditWallet.update({
      where: {
        accountId_productId: { accountId: account.id, productId: product.id },
      },
      data: { debtMilli: 200n, lastOperationSeq: { increment: 1 } },
    });
    const debtOperation = await db.creditOperation.create({
      data: {
        accountId: account.id,
        productId: product.id,
        kind: "adjustment",
        operationKey: "test-debt",
        walletSeq: indebted.lastOperationSeq,
        balanceAfterMilli: 0n,
        debtAfterMilli: 200n,
      },
    });
    await db.creditLedgerEntry.create({
      data: {
        accountId: account.id,
        productId: product.id,
        operationId: debtOperation.id,
        reason: "debt",
        amountMilli: 200n,
      },
    });
    await db.planVersion.create({
      data: {
        planId: plan.id,
        version: 2,
        effectiveFrom: new Date(),
        publishedAt: new Date(),
        creditGrants: { [product.code]: "500" },
      },
    });
    const balances = await Promise.all([
      service.balance(account.id, product.id),
      service.balance(account.id, product.id),
    ]);
    expect(balances.map((wallet) => wallet.balanceMilli)).toEqual([300n, 300n]);
    expect(await db.creditOperation.count({ where: { kind: "accrual" } })).toBe(
      1,
    );
    const accrued = await db.creditBucket.findFirstOrThrow({
      where: { sourceType: "plan_grant" },
    });
    expect(accrued.remainingMilli).toBe(300n);
    expect(balances[0]!.debtMilli).toBe(0n);
    expect(
      (
        await db.creditLedgerEntry.aggregate({
          where: { reason: "debt" },
          _sum: { amountMilli: true },
        })
      )._sum.amountMilli,
    ).toBe(0n);
    expect(
      (
        await db.creditLedgerEntry.aggregate({
          where: { reason: { not: "debt" } },
          _sum: { amountMilli: true },
        })
      )._sum.amountMilli,
    ).toBe(300n);
    expect(accrued.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(balances[0]!.nextAccrualAt).toEqual(accrued.expiresAt);
    expect(balances[0]!.nextExpiryAt).toEqual(accrued.expiresAt);
  } finally {
    await db.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await postgres.stop();
  }
}, 120000);
