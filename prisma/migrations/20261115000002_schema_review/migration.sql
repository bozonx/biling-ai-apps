-- AlterEnum
BEGIN;
CREATE TYPE "UsageStatus_new" AS ENUM ('ok', 'error', 'partial');
ALTER TABLE "UsageEvent" ALTER COLUMN "status" TYPE "UsageStatus_new" USING ("status"::text::"UsageStatus_new");
ALTER TYPE "UsageStatus" RENAME TO "UsageStatus_old";
ALTER TYPE "UsageStatus_new" RENAME TO "UsageStatus";
DROP TYPE "UsageStatus_old";
COMMIT;

-- DropIndex
DROP INDEX "Offer_source_externalPriceId_key";

-- DropIndex
DROP INDEX "PaymentRefund_source_externalId_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "display" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "BillingAccount" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "display" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "PlanVersion" ADD COLUMN     "revokedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CreditPack" ADD COLUMN     "display" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ProductFeature" ADD COLUMN     "display" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "FeaturePrice" ADD COLUMN     "per" BIGINT NOT NULL DEFAULT 1,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'action';

-- AlterTable
ALTER TABLE "CreditWallet" ADD COLUMN     "lastOperationSeq" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "nextAccrualAt" TIMESTAMPTZ(3),
ADD COLUMN     "nextExpiryAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CreditOperation" ADD COLUMN     "balanceAfterMilli" BIGINT NOT NULL,
ADD COLUMN     "debtAfterMilli" BIGINT NOT NULL,
ADD COLUMN     "walletSeq" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "costSource" TEXT NOT NULL,
ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operationId" UUID,
ADD COLUMN     "planVersionId" UUID;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "periodEnd" TIMESTAMPTZ(3),
ADD COLUMN     "periodStart" TIMESTAMPTZ(3),
ADD COLUMN     "revenueAllocation" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ReferralReward" ADD COLUMN     "fraudSignals" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "triggerPaymentId" UUID;

-- AlterTable
ALTER TABLE "BillingWebhookEvent" ADD COLUMN     "accountId" UUID;

-- AlterTable
ALTER TABLE "EntitlementOverride" ADD COLUMN     "targetKind" TEXT NOT NULL DEFAULT 'entitlement';

-- AlterTable
ALTER TABLE "MailOutbox" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US';

-- CreateTable
CREATE TABLE "AdminTask" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "accountId" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTask_dedupeKey_key" ON "AdminTask"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminTask_status_createdAt_idx" ON "AdminTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_source_externalPriceId_idx" ON "Offer"("source", "externalPriceId");

-- CreateIndex
CREATE INDEX "CreditWallet_nextAccrualAt_idx" ON "CreditWallet"("nextAccrualAt");

-- CreateIndex
CREATE INDEX "CreditWallet_nextExpiryAt_idx" ON "CreditWallet"("nextExpiryAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditOperation_accountId_productId_walletSeq_key" ON "CreditOperation"("accountId", "productId", "walletSeq");

-- CreateIndex
CREATE UNIQUE INDEX "CreditOperation_id_accountId_productId_key" ON "CreditOperation"("id", "accountId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBucket_id_accountId_productId_key" ON "CreditBucket"("id", "accountId", "productId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_usageEventId_idx" ON "CreditLedgerEntry"("usageEventId");

-- CreateIndex
CREATE INDEX "UsageEvent_actorId_occurredAt_idx" ON "UsageEvent"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_operationId_idx" ON "UsageEvent"("operationId");

-- CreateIndex
CREATE INDEX "UsageEvent_planVersionId_occurredAt_idx" ON "UsageEvent"("planVersionId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_source_externalId_kind_key" ON "PaymentRefund"("source", "externalId", "kind");

-- CreateIndex
CREATE INDEX "ReferralReward_triggerPaymentId_idx" ON "ReferralReward"("triggerPaymentId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_accountId_idx" ON "BillingWebhookEvent"("accountId");


-- Published catalog content is immutable; sales lifecycle remains editable.
CREATE OR REPLACE FUNCTION billing_immutable_after_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."publishedAt" IS NOT NULL THEN
    IF TG_TABLE_NAME = 'PlanVersion' AND TG_OP = 'UPDATE' THEN
      IF (to_jsonb(NEW) - 'effectiveTo' - 'revokedAt') = (to_jsonb(OLD) - 'effectiveTo' - 'revokedAt') THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION '% is published and immutable', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION billing_protect_columns() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->col IS DISTINCT FROM to_jsonb(NEW)->col THEN
      RAISE EXCEPTION '%.% is immutable', TG_TABLE_NAME, col USING ERRCODE = 'restrict_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER "Product_stable" BEFORE UPDATE OR DELETE ON "Product" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','code');
CREATE TRIGGER "Plan_stable" BEFORE UPDATE OR DELETE ON "Plan" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','code','kind','productScope');
CREATE TRIGGER "ProductFeature_stable" BEFORE UPDATE OR DELETE ON "ProductFeature" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','productId','key');
CREATE TRIGGER "ProductEntitlementKey_stable" BEFORE UPDATE OR DELETE ON "ProductEntitlementKey" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','productId','key','type','merge','enumValues');
CREATE TRIGGER "ProductQuotaKey_stable" BEFORE UPDATE OR DELETE ON "ProductQuotaKey" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','productId','key','unit');
CREATE TRIGGER "Offer_stable" BEFORE UPDATE OR DELETE ON "Offer" FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','planVersionId','source','interval','intervalCount','trialDays','externalPriceId','amountMicros','currency','region','createdAt');
CREATE TRIGGER "AdminAuditLog_append_only" BEFORE UPDATE OR DELETE ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "AdminAuditLog_no_truncate" BEFORE TRUNCATE ON "AdminAuditLog" FOR EACH STATEMENT EXECUTE FUNCTION billing_append_only();
ALTER TABLE "BillingAccount" ADD CHECK (kind <> 'team' OR ("productId" IS NOT NULL AND "externalRef" IS NOT NULL));
ALTER TABLE "LimitPolicy" ADD CHECK ((scope = 'product') = ("productId" IS NOT NULL));
ALTER TABLE "Payment" ADD CHECK ("grossMicros" >= 0 AND "taxMicros" >= 0 AND "feeMicros" >= 0 AND "discountMicros" >= 0 AND "grossUsdMicros" >= 0);
ALTER TABLE "Payment" ADD CHECK (("periodStart" IS NULL AND "periodEnd" IS NULL) OR ("periodStart" IS NOT NULL AND "periodEnd" > "periodStart"));
ALTER TABLE "Subscription" ADD CHECK ("currentPeriodEnd" > "currentPeriodStart");
ALTER TABLE "Offer" ADD CHECK ("amountMicros" >= 0 AND "trialDays" >= 0);
ALTER TABLE "CreditPackOffer" ADD CHECK ("amountMicros" >= 0);
ALTER TABLE "CreditPack" ADD CHECK ("creditsMilli" > 0 AND "validityDays" > 0);
ALTER TABLE "FeaturePrice" ADD CHECK ("per" > 0);
ALTER TABLE "PlanVersion" ADD CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "EntitlementOverride" ADD CHECK ("targetKind" IN ('entitlement', 'quota'));
ALTER TABLE "CreditLedgerEntry" ADD FOREIGN KEY ("operationId", "accountId", "productId") REFERENCES "CreditOperation" (id, "accountId", "productId") ON DELETE RESTRICT;
ALTER TABLE "CreditLedgerEntry" ADD FOREIGN KEY ("bucketId", "accountId", "productId") REFERENCES "CreditBucket" (id, "accountId", "productId") ON DELETE RESTRICT;
ALTER TABLE "CreditBucket" ADD FOREIGN KEY ("operationId", "accountId", "productId") REFERENCES "CreditOperation" (id, "accountId", "productId") ON DELETE RESTRICT;
