-- RAW: то, чем Prisma не управляет (CHECK, триггеры). См. комментарии в schema.prisma.
-- Prisma не сравнивает CHECK и триггеры при migrate diff — дрейфа не будет.

-- ---------------------------------------------------------------------------
-- CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_deleted_ck"
  CHECK (("deletedAt" IS NULL) = ("issuer" IS NOT NULL AND "subject" IS NOT NULL));

ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_personal_ck"
  CHECK (("kind" = 'personal') = ("personalOwnerId" IS NOT NULL));
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_personal_owner_ck"
  CHECK ("personalOwnerId" IS NULL OR "personalOwnerId" = "ownerIdentityId");

ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_nonneg_ck"
  CHECK ("balanceMilli" >= 0 AND "heldMilli" >= 0 AND "debtMilli" >= 0);

ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_amounts_ck"
  CHECK ("grantedMilli" > 0 AND "remainingMilli" >= 0 AND "remainingMilli" <= "grantedMilli");

ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_amount_ck"
  CHECK ("amountMilli" <> 0);
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_debt_ck"
  CHECK (("bucketId" IS NULL) = ("reason" = 'debt'));

ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_feature_ck"
  CHECK ("kind" = 'lease' OR "featureId" IS NOT NULL);
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_amounts_ck"
  CHECK ("amountMilli" > 0 AND "committedMilli" >= 0);
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_price_ck"
  CHECK ("routePriceVersionId" IS NULL OR "featurePriceId" IS NULL);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_target_ck"
  CHECK ("subscriptionId" IS NULL OR "purchaseId" IS NULL);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refunded_ck"
  CHECK ("refundedMicros" >= 0);
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_amount_ck"
  CHECK ("amountMicros" > 0);

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_interval_ck" CHECK ("intervalCount" >= 1);
ALTER TABLE "QuotaReservation" ADD CONSTRAINT "QuotaReservation_amount_ck" CHECK ("amount" >= 0);

-- ---------------------------------------------------------------------------
-- Только дописываются (инвариант 3)
-- ---------------------------------------------------------------------------
CREATE FUNCTION billing_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% rejected)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER "CreditOperation_append_only" BEFORE UPDATE OR DELETE ON "CreditOperation"
  FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "CreditLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "CreditLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "UsageEvent_append_only" BEFORE UPDATE OR DELETE ON "UsageEvent"
  FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "PaymentRefund_append_only" BEFORE UPDATE OR DELETE ON "PaymentRefund"
  FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "SubscriptionEvent_append_only" BEFORE UPDATE OR DELETE ON "SubscriptionEvent"
  FOR EACH ROW EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "CreditLedgerEntry_no_truncate" BEFORE TRUNCATE ON "CreditLedgerEntry"
  FOR EACH STATEMENT EXECUTE FUNCTION billing_append_only();
CREATE TRIGGER "CreditOperation_no_truncate" BEFORE TRUNCATE ON "CreditOperation"
  FOR EACH STATEMENT EXECUTE FUNCTION billing_append_only();

-- ---------------------------------------------------------------------------
-- Версии неизменяемы после публикации (инвариант 7).
-- Черновик (publishedAt IS NULL) можно править и удалять; публикация —
-- UPDATE, выставляющий publishedAt; после неё строка не меняется.
-- ---------------------------------------------------------------------------
CREATE FUNCTION billing_immutable_after_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."publishedAt" IS NOT NULL THEN
    RAISE EXCEPTION '% % is published and immutable', TG_TABLE_NAME, OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PlanVersion_immutable" BEFORE UPDATE OR DELETE ON "PlanVersion"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();
CREATE TRIGGER "CreditRateVersion_immutable" BEFORE UPDATE OR DELETE ON "CreditRateVersion"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();
CREATE TRIGGER "MarkupPolicyVersion_immutable" BEFORE UPDATE OR DELETE ON "MarkupPolicyVersion"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();
CREATE TRIGGER "FeaturePrice_immutable" BEFORE UPDATE OR DELETE ON "FeaturePrice"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();
CREATE TRIGGER "RoutePriceVersion_immutable" BEFORE UPDATE OR DELETE ON "RoutePriceVersion"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();
CREATE TRIGGER "ReferralProgramVersion_immutable" BEFORE UPDATE OR DELETE ON "ReferralProgramVersion"
  FOR EACH ROW EXECUTE FUNCTION billing_immutable_after_publish();

-- Строки цены — по статусу родительской версии (старой и новой)
CREATE FUNCTION billing_price_item_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM "RoutePriceVersion"
        WHERE "id" = OLD."priceVersionId" AND "publishedAt" IS NOT NULL))
     OR (TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM "RoutePriceVersion"
        WHERE "id" = NEW."priceVersionId" AND "publishedAt" IS NOT NULL)) THEN
    RAISE EXCEPTION 'RoutePriceVersion is published; items are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "RoutePriceItem_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "RoutePriceItem"
  FOR EACH ROW EXECUTE FUNCTION billing_price_item_immutable();
