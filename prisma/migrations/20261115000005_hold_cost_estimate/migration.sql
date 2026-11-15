ALTER TABLE "CreditHold" ADD COLUMN "estimatedCostNanos" BIGINT CHECK ("estimatedCostNanos" >= 0);
