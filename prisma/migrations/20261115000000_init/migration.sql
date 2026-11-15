-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('personal', 'team');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('paddle', 'polar', 'revenuecat', 'manual');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('bool', 'int', 'enum');

-- CreateEnum
CREATE TYPE "EntitlementMerge" AS ENUM ('max', 'or');

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('base', 'addon', 'bundle');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'unlisted', 'archived');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('day', 'week', 'month', 'year');

-- CreateEnum
CREATE TYPE "FeaturePricing" AS ENUM ('fixed', 'metered');

-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('discount', 'grant');

-- CreateEnum
CREATE TYPE "CreditBucketKind" AS ENUM ('plan', 'pack', 'promo', 'referral', 'compensation', 'trial');

-- CreateEnum
CREATE TYPE "CreditSourceType" AS ENUM ('subscription', 'plan_grant', 'purchase', 'promotion', 'referral_reward', 'manual');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('accrual', 'purchase', 'consumption', 'expiry', 'refund', 'revoke', 'adjustment', 'referral_reward', 'promo', 'debt', 'debt_repayment');

-- CreateEnum
CREATE TYPE "CreditOperationKind" AS ENUM ('accrual', 'purchase', 'grant', 'commit', 'expiry', 'refund', 'revoke', 'adjustment');

-- CreateEnum
CREATE TYPE "HoldKind" AS ENUM ('hold', 'lease');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('open', 'committed', 'released', 'expired');

-- CreateEnum
CREATE TYPE "UsageStatus" AS ENUM ('ok', 'error', 'partial', 'late');

-- CreateEnum
CREATE TYPE "ModelRouteKind" AS ENUM ('llm', 'stt', 'tts', 'image', 'video', 'mt', 'embed');

-- CreateEnum
CREATE TYPE "PriceVersionSource" AS ENUM ('manual', 'seed', 'sync', 'provider-api');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'read_only', 'expired');

-- CreateEnum
CREATE TYPE "SubscriptionEventKind" AS ENUM ('created', 'status_changed', 'plan_changed', 'change_scheduled', 'change_canceled', 'cancel_scheduled', 'cancel_reverted', 'period_renewed');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('pending', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('subscription_initial', 'subscription_renewal', 'subscription_change', 'one_time');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'chargeback');

-- CreateEnum
CREATE TYPE "RefundKind" AS ENUM ('refund', 'chargeback', 'chargeback_reversal');

-- CreateEnum
CREATE TYPE "PlanGrantSource" AS ENUM ('default', 'referral', 'promo', 'manual', 'beta');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('active', 'ended', 'revoked', 'converted');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('user', 'partner');

-- CreateEnum
CREATE TYPE "ReferralProgramStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('attributed', 'converted', 'rejected');

-- CreateEnum
CREATE TYPE "ReferralRewardKind" AS ENUM ('credits', 'plan_grant', 'commission');

-- CreateEnum
CREATE TYPE "ReferralRewardRole" AS ENUM ('referrer', 'referred');

-- CreateEnum
CREATE TYPE "ReferralTrigger" AS ENUM ('signup', 'first_payment', 'milestone', 'renewal');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('pending', 'review', 'granted', 'void');

-- CreateEnum
CREATE TYPE "LimitPolicyScope" AS ENUM ('product', 'deployment');

-- CreateEnum
CREATE TYPE "LimitWindow" AS ENUM ('minute', 'hour', 'day', 'month');

-- CreateEnum
CREATE TYPE "LimitMeter" AS ENUM ('credits', 'cost_nanos', 'requests');

-- CreateEnum
CREATE TYPE "LimitAction" AS ENUM ('deny');

-- CreateEnum
CREATE TYPE "QuotaReservationStatus" AS ENUM ('open', 'committed', 'released', 'expired');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "EndpointStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'delivered', 'failed', 'dead');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('received', 'processing', 'processed', 'failed', 'ignored');

-- CreateEnum
CREATE TYPE "StaffRoleKind" AS ENUM ('owner', 'admin', 'support', 'viewer');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEntitlementKey" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "merge" "EntitlementMerge" NOT NULL,
    "enumValues" TEXT[],
    "keepOnReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductEntitlementKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" UUID NOT NULL,
    "issuer" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" UUID NOT NULL,
    "kind" "AccountKind" NOT NULL DEFAULT 'personal',
    "ownerIdentityId" UUID,
    "personalOwnerId" UUID,
    "productId" UUID,
    "externalRef" TEXT,
    "country" CHAR(2),
    "email" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountCustomer" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRateVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "creditValueMicros" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditRateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkupPolicyVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "tiers" JSONB NOT NULL,
    "minChargeMilli" BIGINT,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkupPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "productScope" TEXT[],
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "quotas" JSONB NOT NULL DEFAULT '{}',
    "creditGrants" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "requiresBasePlanId" UUID,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "externalPriceId" TEXT,
    "amountMicros" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPack" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "creditsMilli" BIGINT NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "visibility" "Visibility" NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackOffer" (
    "id" UUID NOT NULL,
    "creditPackId" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalPriceId" TEXT,
    "amountMicros" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPackOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requires" JSONB NOT NULL DEFAULT '{}',
    "pricing" "FeaturePricing" NOT NULL,
    "defaultRouteId" UUID,
    "defaultHoldTtlSec" INTEGER NOT NULL DEFAULT 300,
    "status" "FeatureStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturePrice" (
    "id" UUID NOT NULL,
    "featureId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "creditsMilli" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "rules" JSONB NOT NULL,
    "externalDiscountId" TEXT,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "maxRedemptions" INTEGER,
    "maxPerAccount" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "balanceMilli" BIGINT NOT NULL DEFAULT 0,
    "heldMilli" BIGINT NOT NULL DEFAULT 0,
    "debtMilli" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("accountId","productId")
);

-- CreateTable
CREATE TABLE "CreditOperation" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "kind" "CreditOperationKind" NOT NULL,
    "operationKey" TEXT NOT NULL,
    "actorId" UUID,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditBucket" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "kind" "CreditBucketKind" NOT NULL,
    "grantedMilli" BIGINT NOT NULL,
    "remainingMilli" BIGINT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "creditRateVersionId" UUID NOT NULL,
    "sourceType" "CreditSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(3),
    "operationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "bucketId" UUID,
    "amountMilli" BIGINT NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "actorId" UUID,
    "usageEventId" UUID,
    "holdId" UUID,
    "paymentId" UUID,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditHold" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "actorId" UUID,
    "featureId" UUID,
    "routeId" UUID,
    "amountMilli" BIGINT NOT NULL,
    "committedMilli" BIGINT NOT NULL DEFAULT 0,
    "routePriceVersionId" UUID,
    "featurePriceId" UUID,
    "kind" "HoldKind" NOT NULL DEFAULT 'hold',
    "status" "HoldStatus" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "actorId" UUID,
    "holdId" UUID,
    "featureId" UUID NOT NULL,
    "routeId" UUID,
    "provider" TEXT,
    "model" TEXT,
    "meters" JSONB NOT NULL DEFAULT '{}',
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "costNanos" BIGINT NOT NULL DEFAULT 0,
    "routePriceVersionId" UUID,
    "markupPolicyVersionId" UUID,
    "creditRateVersionId" UUID,
    "featurePriceId" UUID,
    "creditsChargedMilli" BIGINT NOT NULL DEFAULT 0,
    "status" "UsageStatus" NOT NULL,
    "byok" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "traceId" TEXT,
    "rawUsage" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEventKey" (
    "productId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "usageEventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEventKey_pkey" PRIMARY KEY ("productId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "ModelRoute" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'standard',
    "kind" "ModelRouteKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelRoute" (
    "productId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "requires" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductModelRoute_pkey" PRIMARY KEY ("productId","routeId")
);

-- CreateTable
CREATE TABLE "RoutePriceVersion" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "source" "PriceVersionSource" NOT NULL,
    "approvedBy" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutePriceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePriceItem" (
    "id" UUID NOT NULL,
    "priceVersionId" UUID NOT NULL,
    "meter" TEXT NOT NULL,
    "unitNanos" BIGINT NOT NULL,
    "per" BIGINT NOT NULL DEFAULT 1,
    "tier" JSONB,
    "minBillableUnits" BIGINT,

    CONSTRAINT "RoutePriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "offerId" UUID,
    "source" "PaymentSource" NOT NULL,
    "externalSubscriptionId" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMPTZ(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(3) NOT NULL,
    "trialEndsAt" TIMESTAMPTZ(3),
    "pastDueSince" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "scheduledPlanVersionId" UUID,
    "scheduledOfferId" UUID,
    "scheduledChangeAt" TIMESTAMPTZ(3),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "store" TEXT,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "kind" "SubscriptionEventKind" NOT NULL,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus",
    "fromPlanVersionId" UUID,
    "toPlanVersionId" UUID,
    "webhookEventId" UUID,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "creditPackOfferId" UUID NOT NULL,
    "creditsMilli" BIGINT NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'pending',
    "bucketId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "subscriptionId" UUID,
    "purchaseId" UUID,
    "planVersionId" UUID,
    "offerId" UUID,
    "source" "PaymentSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "grossMicros" BIGINT NOT NULL,
    "taxMicros" BIGINT NOT NULL DEFAULT 0,
    "feeMicros" BIGINT NOT NULL DEFAULT 0,
    "discountMicros" BIGINT NOT NULL DEFAULT 0,
    "netMicros" BIGINT NOT NULL,
    "grossUsdMicros" BIGINT NOT NULL,
    "netUsdMicros" BIGINT NOT NULL,
    "fxRate" DECIMAL(20,10) NOT NULL,
    "fxSource" TEXT NOT NULL,
    "netIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "refundedMicros" BIGINT NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" "RefundKind" NOT NULL,
    "amountMicros" BIGINT NOT NULL,
    "amountUsdMicros" BIGINT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanGrant" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "source" "PlanGrantSource" NOT NULL,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "status" "GrantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlanGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tier" "PartnerTier" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralProgram" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "productScope" TEXT[],
    "status" "ReferralProgramStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralProgramVersion" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMPTZ(3),

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralClick" (
    "id" UUID NOT NULL,
    "codeId" UUID NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "codeId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "programVersionId" UUID NOT NULL,
    "referredAccountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'attributed',
    "attributedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "beneficiaryAccountId" UUID NOT NULL,
    "role" "ReferralRewardRole" NOT NULL,
    "kind" "ReferralRewardKind" NOT NULL,
    "productId" UUID NOT NULL,
    "creditsMilli" BIGINT,
    "planVersionId" UUID,
    "durationDays" INTEGER,
    "trigger" "ReferralTrigger" NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'pending',
    "availableAt" TIMESTAMPTZ(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitPolicy" (
    "id" UUID NOT NULL,
    "productId" UUID,
    "scope" "LimitPolicyScope" NOT NULL,
    "window" "LimitWindow" NOT NULL,
    "meter" "LimitMeter" NOT NULL,
    "max" BIGINT NOT NULL,
    "action" "LimitAction" NOT NULL DEFAULT 'deny',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LimitPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuotaKey" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "overPolicy" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductQuotaKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "overSince" TIMESTAMPTZ(3),

    CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("accountId","productId","key")
);

-- CreateTable
CREATE TABLE "QuotaReservation" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "committedAmount" BIGINT,
    "status" "QuotaReservationStatus" NOT NULL DEFAULT 'open',
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsageSnapshot" (
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "value" BIGINT NOT NULL,
    "peak" BIGINT NOT NULL,

    CONSTRAINT "QuotaUsageSnapshot_pkey" PRIMARY KEY ("accountId","productId","key","day")
);

-- CreateTable
CREATE TABLE "ProductApiKey" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProductApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductWebhookEndpoint" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "events" TEXT[],
    "status" "EndpointStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "productId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxDelivery" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" UUID NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "type" TEXT,
    "payload" JSONB,
    "payloadPurgedAt" TIMESTAMPTZ(3),
    "status" "InboxStatus" NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementOverride" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitOverride" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "rule" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimitOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "identityId" UUID NOT NULL,
    "role" "StaffRoleKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("identityId","role")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "actorIdentityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailOutbox" (
    "id" UUID NOT NULL,
    "accountId" UUID,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEntitlementKey_productId_key_key" ON "ProductEntitlementKey"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_issuer_subject_key" ON "Identity"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_personalOwnerId_key" ON "BillingAccount"("personalOwnerId");

-- CreateIndex
CREATE INDEX "BillingAccount_ownerIdentityId_idx" ON "BillingAccount"("ownerIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_productId_externalRef_key" ON "BillingAccount"("productId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCustomer_source_externalCustomerId_key" ON "AccountCustomer"("source", "externalCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCustomer_accountId_source_key" ON "AccountCustomer"("accountId", "source");

-- CreateIndex
CREATE INDEX "CreditRateVersion_productId_effectiveFrom_idx" ON "CreditRateVersion"("productId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CreditRateVersion_productId_version_key" ON "CreditRateVersion"("productId", "version");

-- CreateIndex
CREATE INDEX "MarkupPolicyVersion_productId_effectiveFrom_idx" ON "MarkupPolicyVersion"("productId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MarkupPolicyVersion_productId_version_key" ON "MarkupPolicyVersion"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "Offer_planVersionId_idx" ON "Offer"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_source_externalPriceId_key" ON "Offer"("source", "externalPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_productId_code_key" ON "CreditPack"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackOffer_source_externalPriceId_key" ON "CreditPackOffer"("source", "externalPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeature_productId_key_key" ON "ProductFeature"("productId", "key");

-- CreateIndex
CREATE INDEX "FeaturePrice_featureId_effectiveFrom_idx" ON "FeaturePrice"("featureId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturePrice_featureId_version_key" ON "FeaturePrice"("featureId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_idempotencyKey_key" ON "PromotionRedemption"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotionId_accountId_idx" ON "PromotionRedemption"("promotionId", "accountId");

-- CreateIndex
CREATE INDEX "CreditOperation_accountId_productId_createdAt_idx" ON "CreditOperation"("accountId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditOperation_productId_operationKey_key" ON "CreditOperation"("productId", "operationKey");

-- CreateIndex
CREATE INDEX "CreditBucket_accountId_productId_expiresAt_idx" ON "CreditBucket"("accountId", "productId", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditBucket_sourceType_sourceId_idx" ON "CreditBucket"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CreditBucket_expiredAt_expiresAt_idx" ON "CreditBucket"("expiredAt", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_accountId_productId_createdAt_idx" ON "CreditLedgerEntry"("accountId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_operationId_idx" ON "CreditLedgerEntry"("operationId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_bucketId_idx" ON "CreditLedgerEntry"("bucketId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_holdId_idx" ON "CreditLedgerEntry"("holdId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_paymentId_idx" ON "CreditLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "CreditHold_status_expiresAt_idx" ON "CreditHold"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditHold_accountId_productId_status_idx" ON "CreditHold"("accountId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditHold_productId_idempotencyKey_key" ON "CreditHold"("productId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_accountId_productId_occurredAt_idx" ON "UsageEvent"("accountId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_productId_occurredAt_idx" ON "UsageEvent"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_provider_occurredAt_idx" ON "UsageEvent"("provider", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_featureId_occurredAt_idx" ON "UsageEvent"("featureId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_holdId_idx" ON "UsageEvent"("holdId");

-- CreateIndex
CREATE INDEX "UsageEventKey_createdAt_idx" ON "UsageEventKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRoute_provider_model_variant_key" ON "ModelRoute"("provider", "model", "variant");

-- CreateIndex
CREATE INDEX "RoutePriceVersion_routeId_effectiveFrom_idx" ON "RoutePriceVersion"("routeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePriceVersion_routeId_version_key" ON "RoutePriceVersion"("routeId", "version");

-- CreateIndex
CREATE INDEX "RoutePriceItem_priceVersionId_meter_idx" ON "RoutePriceItem"("priceVersionId", "meter");

-- CreateIndex
CREATE INDEX "Subscription_accountId_status_idx" ON "Subscription"("accountId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_source_externalSubscriptionId_key" ON "Subscription"("source", "externalSubscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_occurredAt_idx" ON "SubscriptionEvent"("subscriptionId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_bucketId_key" ON "Purchase"("bucketId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_source_externalId_key" ON "Purchase"("source", "externalId");

-- CreateIndex
CREATE INDEX "Payment_accountId_occurredAt_idx" ON "Payment"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX "Payment_planVersionId_occurredAt_idx" ON "Payment"("planVersionId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_source_externalId_key" ON "Payment"("source", "externalId");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_source_externalId_key" ON "PaymentRefund"("source", "externalId");

-- CreateIndex
CREATE INDEX "PlanGrant_accountId_productId_status_idx" ON "PlanGrant"("accountId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanGrant_productId_idempotencyKey_key" ON "PlanGrant"("productId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_accountId_key" ON "Partner"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProgram_code_key" ON "ReferralProgram"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProgramVersion_programId_version_key" ON "ReferralProgramVersion"("programId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralClick_codeId_createdAt_idx" ON "ReferralClick"("codeId", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_codeId_idx" ON "Referral"("codeId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredAccountId_productId_key" ON "Referral"("referredAccountId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_idempotencyKey_key" ON "ReferralReward"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReferralReward_status_availableAt_idx" ON "ReferralReward"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ReferralReward_beneficiaryAccountId_createdAt_idx" ON "ReferralReward"("beneficiaryAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_referralId_idx" ON "ReferralReward"("referralId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductQuotaKey_productId_key_key" ON "ProductQuotaKey"("productId", "key");

-- CreateIndex
CREATE INDEX "QuotaReservation_accountId_productId_key_status_idx" ON "QuotaReservation"("accountId", "productId", "key", "status");

-- CreateIndex
CREATE INDEX "QuotaReservation_status_expiresAt_idx" ON "QuotaReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaReservation_productId_idempotencyKey_key" ON "QuotaReservation"("productId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductApiKey_keyHash_key" ON "ProductApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ProductApiKey_productId_idx" ON "ProductApiKey"("productId");

-- CreateIndex
CREATE INDEX "ProductWebhookEndpoint_productId_idx" ON "ProductWebhookEndpoint"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_productId_createdAt_idx" ON "OutboxEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxDelivery_status_nextAttemptAt_idx" ON "OutboxDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxDelivery_eventId_endpointId_key" ON "OutboxDelivery"("eventId", "endpointId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_status_receivedAt_idx" ON "BillingWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_source_externalEventId_key" ON "BillingWebhookEvent"("source", "externalEventId");

-- CreateIndex
CREATE INDEX "EntitlementOverride_accountId_productId_idx" ON "EntitlementOverride"("accountId", "productId");

-- CreateIndex
CREATE INDEX "LimitOverride_accountId_productId_idx" ON "LimitOverride"("accountId", "productId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailOutbox_dedupeKey_key" ON "MailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "MailOutbox_status_nextAttemptAt_idx" ON "MailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MailOutbox_accountId_idx" ON "MailOutbox"("accountId");

-- AddForeignKey
ALTER TABLE "ProductEntitlementKey" ADD CONSTRAINT "ProductEntitlementKey_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_ownerIdentityId_fkey" FOREIGN KEY ("ownerIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_personalOwnerId_fkey" FOREIGN KEY ("personalOwnerId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCustomer" ADD CONSTRAINT "AccountCustomer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRateVersion" ADD CONSTRAINT "CreditRateVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkupPolicyVersion" ADD CONSTRAINT "MarkupPolicyVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_requiresBasePlanId_fkey" FOREIGN KEY ("requiresBasePlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPack" ADD CONSTRAINT "CreditPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPackOffer" ADD CONSTRAINT "CreditPackOffer_creditPackId_fkey" FOREIGN KEY ("creditPackId") REFERENCES "CreditPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeature" ADD CONSTRAINT "ProductFeature_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeature" ADD CONSTRAINT "ProductFeature_defaultRouteId_fkey" FOREIGN KEY ("defaultRouteId") REFERENCES "ModelRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePrice" ADD CONSTRAINT "FeaturePrice_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ProductFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditOperation" ADD CONSTRAINT "CreditOperation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditOperation" ADD CONSTRAINT "CreditOperation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_creditRateVersionId_fkey" FOREIGN KEY ("creditRateVersionId") REFERENCES "CreditRateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBucket" ADD CONSTRAINT "CreditBucket_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CreditOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CreditOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CreditBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ProductFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ModelRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_routePriceVersionId_fkey" FOREIGN KEY ("routePriceVersionId") REFERENCES "RoutePriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_featurePriceId_fkey" FOREIGN KEY ("featurePriceId") REFERENCES "FeaturePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelRoute" ADD CONSTRAINT "ProductModelRoute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelRoute" ADD CONSTRAINT "ProductModelRoute_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ModelRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePriceVersion" ADD CONSTRAINT "RoutePriceVersion_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ModelRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePriceItem" ADD CONSTRAINT "RoutePriceItem_priceVersionId_fkey" FOREIGN KEY ("priceVersionId") REFERENCES "RoutePriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledPlanVersionId_fkey" FOREIGN KEY ("scheduledPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledOfferId_fkey" FOREIGN KEY ("scheduledOfferId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_fromPlanVersionId_fkey" FOREIGN KEY ("fromPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_toPlanVersionId_fkey" FOREIGN KEY ("toPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_creditPackOfferId_fkey" FOREIGN KEY ("creditPackOfferId") REFERENCES "CreditPackOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CreditBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanGrant" ADD CONSTRAINT "PlanGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanGrant" ADD CONSTRAINT "PlanGrant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanGrant" ADD CONSTRAINT "PlanGrant_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralProgramVersion" ADD CONSTRAINT "ReferralProgramVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ReferralProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredAccountId_fkey" FOREIGN KEY ("referredAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_beneficiaryAccountId_fkey" FOREIGN KEY ("beneficiaryAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitPolicy" ADD CONSTRAINT "LimitPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuotaKey" ADD CONSTRAINT "ProductQuotaKey_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaReservation" ADD CONSTRAINT "QuotaReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaReservation" ADD CONSTRAINT "QuotaReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsageSnapshot" ADD CONSTRAINT "QuotaUsageSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaUsageSnapshot" ADD CONSTRAINT "QuotaUsageSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApiKey" ADD CONSTRAINT "ProductApiKey_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWebhookEndpoint" ADD CONSTRAINT "ProductWebhookEndpoint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxDelivery" ADD CONSTRAINT "OutboxDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxDelivery" ADD CONSTRAINT "OutboxDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ProductWebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementOverride" ADD CONSTRAINT "EntitlementOverride_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementOverride" ADD CONSTRAINT "EntitlementOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitOverride" ADD CONSTRAINT "LimitOverride_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitOverride" ADD CONSTRAINT "LimitOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

