import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client.js";

// Fixed ids so local .env can reference them (see .env.example).
const PRODUCT_ID = "0193a000-0000-7000-8000-000000000001";
const DEV_ACCOUNT_ID = "0193a000-0000-7000-8000-000000000002";
const CREDIT_RATE_ID = "0193a000-0000-7000-8000-000000000003";
const DEV_IDENTITY_ID = "0193a000-0000-7000-8000-000000000004";
const INITIAL_GRANT_MILLI = 1_000_000n; // 1000 credits
const GRANT_KEY = "seed:dev-account:initial-grant";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  try {
    const product = await db.product.upsert({
      where: { code: "tyco" },
      create: { id: PRODUCT_ID, code: "tyco", name: "TyCo" },
      update: {},
    });
    const productId = product.id;

    const rate = await db.creditRateVersion.upsert({
      where: { productId_version: { productId, version: 1 } },
      create: {
        id: CREDIT_RATE_ID,
        productId,
        version: 1,
        creditValueMicros: 10_000n, // 1 credit = $0.01
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        publishedAt: new Date("2026-01-01T00:00:00Z"),
      },
      update: {},
    });

    if (process.env.NODE_ENV !== "production") {
      await db.identity.upsert({
        where: { id: DEV_IDENTITY_ID },
        create: { id: DEV_IDENTITY_ID },
        update: {},
      });
      await db.billingAccount.upsert({
        where: { id: DEV_ACCOUNT_ID },
        create: {
          id: DEV_ACCOUNT_ID,
          ownerIdentityId: DEV_IDENTITY_ID,
          personalOwnerId: DEV_IDENTITY_ID,
          email: "dev@example.com",
          locale: "ru",
        },
        update: {},
      });
      await db.staffRole.upsert({
        where: {
          identityId_role: { identityId: DEV_IDENTITY_ID, role: "admin" },
        },
        create: { identityId: DEV_IDENTITY_ID, role: "admin" },
        update: {},
      });
      await grantOnce(productId, rate.id);
    }

    console.log(`DEV_PRODUCT_ID=${productId}`);
    console.log(`DEV_ACCOUNT_ID=${DEV_ACCOUNT_ID}`);
  } finally {
    await db.$disconnect();
  }
}

async function grantOnce(productId: string, creditRateVersionId: string) {
  await db.$transaction(async (tx) => {
    const exists = await tx.creditOperation.findUnique({
      where: { productId_operationKey: { productId, operationKey: GRANT_KEY } },
    });
    if (exists) return;
    const accountId = DEV_ACCOUNT_ID;
    const wallet = await tx.creditWallet.upsert({
      where: { accountId_productId: { accountId, productId } },
      create: { accountId, productId },
      update: {},
    });
    const amount = INITIAL_GRANT_MILLI;
    const operation = await tx.creditOperation.create({
      data: {
        accountId,
        productId,
        kind: "grant",
        operationKey: GRANT_KEY,
        walletSeq: wallet.lastOperationSeq + 1n,
        balanceAfterMilli: wallet.balanceMilli + amount,
        debtAfterMilli: wallet.debtMilli,
        meta: {
          accountId,
          amountMilli: amount.toString(),
          creditRateVersionId,
        },
      },
    });
    const bucket = await tx.creditBucket.create({
      data: {
        accountId,
        productId,
        kind: "compensation",
        grantedMilli: amount,
        remainingMilli: amount,
        creditRateVersionId,
        sourceType: "manual",
        sourceId: operation.id,
        operationId: operation.id,
      },
    });
    await tx.creditLedgerEntry.create({
      data: {
        accountId,
        productId,
        operationId: operation.id,
        bucketId: bucket.id,
        amountMilli: amount,
        reason: "adjustment",
      },
    });
    await tx.creditWallet.update({
      where: { accountId_productId: { accountId, productId } },
      data: {
        balanceMilli: { increment: amount },
        lastOperationSeq: { increment: 1 },
        version: { increment: 1 },
      },
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
