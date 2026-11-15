-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PurchaseStatus" ADD VALUE 'failed';
ALTER TYPE "PurchaseStatus" ADD VALUE 'partially_refunded';
ALTER TYPE "PurchaseStatus" ADD VALUE 'chargeback';

-- AlterEnum
BEGIN;
CREATE TYPE "ReferralRewardKind_new" AS ENUM ('credits', 'plan_grant');
ALTER TABLE "ReferralReward" ALTER COLUMN "kind" TYPE "ReferralRewardKind_new" USING ("kind"::text::"ReferralRewardKind_new");
ALTER TYPE "ReferralRewardKind" RENAME TO "ReferralRewardKind_old";
ALTER TYPE "ReferralRewardKind_new" RENAME TO "ReferralRewardKind";
DROP TYPE "ReferralRewardKind_old";
COMMIT;

-- AlterTable
ALTER TABLE "PlanVersion" ADD COLUMN     "creditGrantInterval" "BillingInterval" NOT NULL DEFAULT 'month',
ADD COLUMN     "creditGrantIntervalCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "trialCreditGrants" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "checkoutSessionId" UUID,
ALTER COLUMN "externalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlanGrant" ADD COLUMN     "planId" UUID,
ALTER COLUMN "planVersionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "IdentityBinding" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "issuer" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "IdentityBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "offerId" UUID,
    "creditPackOfferId" UUID,
    "promotionId" UUID,
    "referralId" UUID,
    "returnUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitUsageWindow" (
    "scopeKey" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowEnd" TIMESTAMPTZ(3) NOT NULL,
    "meter" "LimitMeter" NOT NULL,
    "consumed" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LimitUsageWindow_pkey" PRIMARY KEY ("scopeKey","windowStart","meter")
);

-- CreateIndex
CREATE INDEX "IdentityBinding_identityId_idx" ON "IdentityBinding"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityBinding_issuer_subject_key" ON "IdentityBinding"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_idempotencyKey_key" ON "CheckoutSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CheckoutSession_accountId_createdAt_idx" ON "CheckoutSession"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_status_expiresAt_idx" ON "CheckoutSession"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_source_externalId_key" ON "CheckoutSession"("source", "externalId");

-- CreateIndex
CREATE INDEX "LimitUsageWindow_windowEnd_idx" ON "LimitUsageWindow"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_checkoutSessionId_key" ON "Purchase"("checkoutSessionId");

-- AddForeignKey
ALTER TABLE "PlanGrant" ADD CONSTRAINT "PlanGrant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityBinding" ADD CONSTRAINT "IdentityBinding_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


INSERT INTO "IdentityBinding" (id, "identityId", issuer, subject, "createdAt", "deletedAt")
SELECT id, id, issuer, subject, "createdAt", "deletedAt" FROM "Identity";
ALTER TABLE "Identity" DROP CONSTRAINT "Identity_deleted_ck";
-- DropIndex
DROP INDEX "Identity_issuer_subject_key";

-- AlterTable
ALTER TABLE "Identity" DROP COLUMN "issuer",
DROP COLUMN "subject";


UPDATE "PlanGrant" g SET "planId" = v."planId", "planVersionId" = NULL
FROM "PlanVersion" v WHERE g.source = 'default' AND g."planVersionId" = v.id;
ALTER TABLE "IdentityBinding" ADD CHECK (("deletedAt" IS NULL AND issuer IS NOT NULL AND subject IS NOT NULL) OR ("deletedAt" IS NOT NULL AND issuer IS NULL AND subject IS NULL));
ALTER TABLE "PlanGrant" ADD CHECK ((source = 'default' AND "planId" IS NOT NULL AND "planVersionId" IS NULL) OR (source <> 'default' AND "planId" IS NULL AND "planVersionId" IS NOT NULL));
ALTER TABLE "PlanGrant" ADD CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "PlanVersion" ADD CHECK ("creditGrantIntervalCount" > 0);
ALTER TABLE "LimitUsageWindow" ADD CHECK ("windowEnd" > "windowStart" AND consumed >= 0 AND reserved >= 0);
ALTER TABLE "CheckoutSession" ADD CHECK (("offerId" IS NULL) <> ("creditPackOfferId" IS NULL));
ALTER TABLE "CheckoutSession" ADD CHECK (status IN ('pending', 'completed', 'failed', 'expired'));
ALTER TABLE "ReferralReward" ADD CHECK ((kind = 'credits' AND "creditsMilli" > 0 AND "planVersionId" IS NULL AND "durationDays" IS NULL) OR (kind = 'plan_grant' AND "creditsMilli" IS NULL AND "planVersionId" IS NOT NULL AND "durationDays" > 0));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['PlanVersion','CreditRateVersion','MarkupPolicyVersion','FeaturePrice','RoutePriceVersion'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CHECK ("publishedAt" IS NULL OR "effectiveFrom" >= "publishedAt")', table_name);
  END LOOP;
END $$;
ALTER TABLE "CreditOperation" ADD CHECK ("walletSeq" > 0 AND "balanceAfterMilli" >= 0 AND "debtAfterMilli" >= 0);
ALTER TABLE "Purchase" ADD CHECK ("creditsMilli" > 0 AND "validityDays" > 0);
ALTER TABLE "Payment" ADD CHECK ("netMicros" >= 0 AND "netUsdMicros" >= 0 AND "fxRate" > 0);

-- Match composite relations declared in Prisma; remove redundant single-column FKs.
ALTER TABLE "CreditBucket" DROP CONSTRAINT "CreditBucket_operationId_fkey";
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_operationId_fkey";
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_bucketId_fkey";
