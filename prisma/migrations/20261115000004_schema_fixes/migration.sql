-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('pending', 'completed', 'failed', 'expired');

-- DropForeignKey
ALTER TABLE "CreditBucket" DROP CONSTRAINT "CreditBucket_operationId_accountId_productId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_bucketId_accountId_productId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_operationId_accountId_productId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_bucketId_fkey";

-- DropIndex
DROP INDEX "CheckoutSession_idempotencyKey_key";

-- DropIndex
DROP INDEX "CreditPackOffer_source_externalPriceId_key";

-- DropIndex
DROP INDEX "PromotionRedemption_idempotencyKey_key";

-- AlterTable
-- productId is required; the table holds no production rows yet (checkout is stage 3).
ALTER TABLE "CheckoutSession" ADD COLUMN     "productId" UUID NOT NULL;
-- Convert status in place instead of dropping the column.
ALTER TABLE "CheckoutSession" DROP CONSTRAINT "CheckoutSession_status_check";
ALTER TABLE "CheckoutSession" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CheckoutSession" ALTER COLUMN "status" TYPE "CheckoutSessionStatus" USING ("status"::"CheckoutSessionStatus");
ALTER TABLE "CheckoutSession" ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "CreditHold" ADD COLUMN     "limitReservations" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_productId_idempotencyKey_key" ON "CheckoutSession"("productId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditPackOffer_source_externalPriceId_idx" ON "CreditPackOffer"("source", "externalPriceId");

-- CreateIndex
CREATE INDEX "CreditPackOffer_creditPackId_idx" ON "CreditPackOffer"("creditPackId");

-- CreateIndex
CREATE INDEX "PlanGrant_planVersionId_idx" ON "PlanGrant"("planVersionId");

-- CreateIndex
CREATE INDEX "PlanGrant_planId_idx" ON "PlanGrant"("planId");

-- CreateIndex
CREATE INDEX "PlanVersion_requiresBasePlanId_idx" ON "PlanVersion"("requiresBasePlanId");

-- CreateIndex
CREATE INDEX "PromotionRedemption_accountId_idx" ON "PromotionRedemption"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_promotionId_idempotencyKey_key" ON "PromotionRedemption"("promotionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Purchase_accountId_createdAt_idx" ON "Purchase"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_bucketId_accountId_productId_key" ON "Purchase"("bucketId", "accountId", "productId");

-- CreateIndex
CREATE INDEX "ReferralCode_partnerId_idx" ON "ReferralCode"("partnerId");

-- CreateIndex
CREATE INDEX "Subscription_planVersionId_idx" ON "Subscription"("planVersionId");

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_operationId_accountId_productId_fkey" FOREIGN KEY ("operationId", "accountId", "productId") REFERENCES "CreditOperation"("id", "accountId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_operationId_accountId_productId_fkey" FOREIGN KEY ("operationId", "accountId", "productId") REFERENCES "CreditOperation"("id", "accountId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_bucketId_accountId_productId_fkey" FOREIGN KEY ("bucketId", "accountId", "productId") REFERENCES "CreditBucket"("id", "accountId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_bucketId_accountId_productId_fkey" FOREIGN KEY ("bucketId", "accountId", "productId") REFERENCES "CreditBucket"("id", "accountId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_creditPackOfferId_fkey" FOREIGN KEY ("creditPackOfferId") REFERENCES "CreditPackOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- RAW: CHECK
-- ---------------------------------------------------------------------------
-- MoR facts must not be rejected: the fee can exceed a small payment, so net may be negative.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_check2";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fx_ck" CHECK ("fxRate" > 0);
ALTER TABLE "ReferralProgramVersion" ADD CONSTRAINT "ReferralProgramVersion_publish_ck"
  CHECK ("publishedAt" IS NULL OR "effectiveFrom" >= "publishedAt");

-- ---------------------------------------------------------------------------
-- RAW: catalog guards
-- Stable columns stay immutable, but unreferenced rows may be deleted:
-- Restrict FKs already block deletion of anything that is in use.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing_protect_columns() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col text;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->col IS DISTINCT FROM to_jsonb(NEW)->col THEN
      RAISE EXCEPTION '%.% is immutable', TG_TABLE_NAME, col USING ERRCODE = 'restrict_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- Product.code is referenced without FKs (Plan/ReferralProgram.productScope, JSON keys).
CREATE FUNCTION billing_product_delete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Plan" WHERE OLD."code" = ANY ("productScope"))
     OR EXISTS (SELECT 1 FROM "ReferralProgram" WHERE OLD."code" = ANY ("productScope")) THEN
    RAISE EXCEPTION 'Product % is referenced by productScope', OLD."code" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER "Product_delete_guard" BEFORE DELETE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION billing_product_delete_guard();

-- enumValues may only be extended at the end: the order defines "not less than".
DROP TRIGGER "ProductEntitlementKey_stable" ON "ProductEntitlementKey";
CREATE TRIGGER "ProductEntitlementKey_stable" BEFORE UPDATE OR DELETE ON "ProductEntitlementKey"
  FOR EACH ROW EXECUTE FUNCTION billing_protect_columns('id','productId','key','type','merge');
CREATE FUNCTION billing_enum_values_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n int := coalesce(array_length(OLD."enumValues", 1), 0);
BEGIN
  IF n > 0 AND (coalesce(array_length(NEW."enumValues", 1), 0) < n
                OR NEW."enumValues"[1:n] IS DISTINCT FROM OLD."enumValues") THEN
    RAISE EXCEPTION 'ProductEntitlementKey.enumValues can only be appended' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ProductEntitlementKey_enum_append" BEFORE UPDATE ON "ProductEntitlementKey"
  FOR EACH ROW EXECUTE FUNCTION billing_enum_values_append_only();

-- Offer: free while its plan version is a draft; once published only isActive
-- changes and externalPriceId may be filled once (price created at the source on publish).
DROP TRIGGER "Offer_stable" ON "Offer";
CREATE FUNCTION billing_offer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PlanVersion" WHERE "id" = OLD."planVersionId" AND "publishedAt" IS NOT NULL) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Offer of a published plan version cannot be deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."externalPriceId" IS NOT NULL AND NEW."externalPriceId" IS DISTINCT FROM OLD."externalPriceId" THEN
    RAISE EXCEPTION 'Offer.externalPriceId is immutable once set' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'isActive' - 'externalPriceId') <> (to_jsonb(OLD) - 'isActive' - 'externalPriceId') THEN
    RAISE EXCEPTION 'Offer of a published plan version is immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Offer_guard" BEFORE UPDATE OR DELETE ON "Offer"
  FOR EACH ROW EXECUTE FUNCTION billing_offer_guard();
