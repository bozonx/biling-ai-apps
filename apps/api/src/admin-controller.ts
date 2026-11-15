import { tiersSchema } from "./metering.js";
import { WalletService } from "./wallet.js";
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { Database } from "./database.js";
import { StaffAccess } from "./staff.js";
import { json } from "./json.js";
const id = z.uuid();
const name = z.string().min(1).max(120);
const amount = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
const limitRule = z.object({
  scope: z.enum(["account", "actor"]),
  window: z.enum(["minute", "hour", "day", "month"]),
  meter: z.enum(["requests", "credits", "cost_nanos"]),
  max: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
  feature: name.optional(),
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("route"),
    provider: name,
    model: name,
    variant: name,
    kind: z.enum(["llm", "stt", "tts", "image", "video", "mt", "embed"]),
  }),
  z.object({ action: z.literal("productRoute"), productId: id, routeId: id }),
  z.object({
    action: z.literal("markup"),
    productId: id,
    version: z.number().int().positive(),
    tiers: tiersSchema,
    minChargeMilli: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
    effectiveFrom: z.iso.datetime(),
  }),
  z.object({
    action: z.literal("limitPolicy"),
    productId: id,
    window: limitRule.shape.window,
    meter: limitRule.shape.meter,
    max: limitRule.shape.max,
  }),

  z.object({
    action: z.literal("endVersion"),
    id,
    effectiveTo: z.iso.datetime(),
  }),

  z.object({
    action: z.literal("publish"),
    target: z.enum(["version", "rate", "routePrice", "markup"]),
    id,
    effectiveFrom: z.iso.datetime(),
  }),
  z.object({ action: z.literal("revokeVersion"), id }),

  z.object({
    action: z.literal("routePrice"),
    routeId: id,
    version: z.number().int().positive(),
    effectiveFrom: z.iso.datetime(),
    items: z
      .array(
        z.object({
          meter: name,
          unitNanos: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
          per: amount,
          minBillableUnits: amount.optional(),
          tier: z
            .object({ fromContextTokens: z.number().int().nonnegative() })
            .optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    action: z.literal("price"),
    featureId: id,
    version: z.number().int().positive(),
    creditsMilli: amount,
    unit: name,
    per: amount,
  }),
  z.object({
    action: z.literal("product"),
    code: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
    name,
  }),
  z.object({
    action: z.literal("feature"),
    productId: id,
    key: name,
    pricing: z.enum(["fixed", "metered"]),
  }),
  z.object({
    action: z.literal("rate"),
    productId: id,
    version: z.number().int().positive(),
    creditValueMicros: amount,
  }),
  z.object({
    action: z.literal("plan"),
    code: name,
    name,
    productScope: z.array(name).min(1),
    kind: z.enum(["base", "addon"]),
  }),
  z.object({
    action: z.literal("version"),
    planId: id,
    version: z.number().int().positive(),
    creditGrants: z.record(z.string(), amount),
    limits: z.record(z.string(), z.array(limitRule)).default({}),
    entitlements: z.record(
      z.string(),
      z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
    ),
    creditGrantInterval: z.enum(["day", "week", "month", "year"]),
    creditGrantIntervalCount: z.number().int().min(1).max(120),
  }),
  z.object({
    action: z.literal("key"),
    productId: id,
    name,
    scopes: z
      .array(
        z.enum([
          "wallets:read",
          "entitlements:read",
          "usage:read",
          "holds:write",
          "credits:grant",
        ]),
      )
      .min(1),
  }),
  z.object({ action: z.literal("revokeKey"), id }),
]);
@Controller("admin")
export class AdminController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(WalletService) private readonly wallets: WalletService,
    @Inject(StaffAccess) private readonly staff: StaffAccess,
  ) {}
  @Post("credits")
  async grant(
    @Headers("authorization") auth: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    const actor = await this.staff.authorize(auth, true);
    const input = z
      .object({
        productId: id,
        accountId: id,
        amountMilli: amount,
        creditRateVersionId: id,
      })
      .safeParse(body);
    if (!input.success || !key || key.length > 200)
      throw new BadRequestException({ code: "INVALID_REQUEST" });
    return json(
      await this.wallets.grant(input.data.productId, key, input.data, actor),
    );
  }
  @Get("margin")
  async margin(@Headers("authorization") auth?: string) {
    await this.staff.authorize(auth);
    return json(
      await this.db.usageEvent.groupBy({
        by: ["productId", "routeId", "provider", "model"],
        _sum: { creditsChargedMilli: true, costNanos: true },
        _count: true,
      }),
    );
  }
  @Get("catalog")
  async catalog(@Headers("authorization") auth?: string) {
    await this.staff.authorize(auth);
    const [
      products,
      features,
      prices,
      rates,
      plans,
      versions,
      keys,
      routes,
      routePrices,
      markups,
      productRoutes,
      tasks,
    ] = await Promise.all([
      this.db.product.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      this.db.productFeature.findMany({ take: 100 }),
      this.db.featurePrice.findMany({ take: 100 }),
      this.db.creditRateVersion.findMany({ take: 100 }),
      this.db.plan.findMany({ take: 100 }),
      this.db.planVersion.findMany({ take: 100 }),
      this.db.productApiKey.findMany({
        take: 100,
        select: {
          id: true,
          productId: true,
          name: true,
          prefix: true,
          scopes: true,
          status: true,
        },
      }),
      this.db.modelRoute.findMany({ take: 100 }),
      this.db.routePriceVersion.findMany({
        take: 100,
        include: { items: true },
      }),
      this.db.markupPolicyVersion.findMany({ take: 100 }),
      this.db.productModelRoute.findMany({ take: 100 }),
      this.db.adminTask.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
    ]);
    return json({
      products,
      features,
      prices,
      rates,
      plans,
      versions,
      keys,
      routes,
      routePrices,
      markups,
      productRoutes,
      tasks,
    });
  }
  @Post("catalog")
  async change(
    @Headers("authorization") auth: string | undefined,
    @Body() body: unknown,
  ) {
    const actorIdentityId = await this.staff.authorize(auth, true);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({ code: "INVALID_REQUEST" });
    const input = parsed.data;
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      let result: { id: string };
      let secret: string | undefined;
      switch (input.action) {
        case "route":
          result = await tx.modelRoute.create({
            data: {
              provider: input.provider,
              model: input.model,
              variant: input.variant,
              kind: input.kind,
            },
          });
          break;
        case "productRoute":
          await tx.productModelRoute.upsert({
            where: {
              productId_routeId: {
                productId: input.productId,
                routeId: input.routeId,
              },
            },
            update: { isActive: true },
            create: { productId: input.productId, routeId: input.routeId },
          });
          result = { id: input.routeId };
          break;
        case "markup":
          result = await tx.markupPolicyVersion.create({
            data: {
              productId: input.productId,
              version: input.version,
              tiers: input.tiers,
              minChargeMilli: BigInt(input.minChargeMilli),
              effectiveFrom: new Date(input.effectiveFrom),
            },
          });
          break;
        case "limitPolicy":
          result = await tx.limitPolicy.create({
            data: {
              productId: input.productId,
              scope: "product",
              window: input.window,
              meter: input.meter,
              max: BigInt(input.max),
            },
          });
          break;
        case "endVersion":
          result = await tx.planVersion.update({
            where: { id: input.id },
            data: { effectiveTo: new Date(input.effectiveTo) },
          });
          break;
        case "publish": {
          const args = {
            where: { id: input.id, publishedAt: null },
            data: {
              publishedAt: now,
              effectiveFrom: new Date(input.effectiveFrom),
            },
          };
          if (args.data.effectiveFrom < now)
            throw new BadRequestException({ code: "INVALID_EFFECTIVE_FROM" });
          const rows =
            input.target === "version"
              ? await tx.planVersion.updateMany(args)
              : input.target === "rate"
                ? await tx.creditRateVersion.updateMany(args)
                : input.target === "markup"
                  ? await tx.markupPolicyVersion.updateMany(args)
                  : await tx.routePriceVersion.updateMany(args);
          if (rows.count !== 1)
            throw new ConflictException({ code: "VERSION_NOT_DRAFT" });
          result = { id: input.id };
          break;
        }
        case "revokeVersion":
          result = await tx.planVersion.update({
            where: { id: input.id },
            data: { revokedAt: now },
          });
          break;
        case "routePrice":
          result = await tx.routePriceVersion.create({
            data: {
              routeId: input.routeId,
              version: input.version,
              effectiveFrom: new Date(input.effectiveFrom),
              source: "manual",
              approvedBy: actorIdentityId,
              items: {
                create: input.items.map((item) => ({
                  ...item,
                  minBillableUnits:
                    item.minBillableUnits === undefined
                      ? undefined
                      : BigInt(item.minBillableUnits),
                  unitNanos: BigInt(item.unitNanos),
                  per: BigInt(item.per),
                })),
              },
            },
          });
          break;
        case "price":
          result = await tx.featurePrice.create({
            data: {
              featureId: input.featureId,
              version: input.version,
              creditsMilli: BigInt(input.creditsMilli),
              unit: input.unit,
              per: BigInt(input.per),
              publishedAt: now,
              effectiveFrom: now,
            },
          });
          break;
        case "product":
          result = await tx.product.create({
            data: { code: input.code, name: input.name },
          });
          break;
        case "feature":
          result = await tx.productFeature.create({
            data: {
              productId: input.productId,
              key: input.key,
              pricing: input.pricing,
            },
          });
          break;
        case "rate":
          result = await tx.creditRateVersion.create({
            data: {
              productId: input.productId,
              version: input.version,
              creditValueMicros: BigInt(input.creditValueMicros),
              effectiveFrom: now,
            },
          });
          break;
        case "plan":
          result = await tx.plan.create({
            data: {
              code: input.code,
              name: input.name,
              productScope: input.productScope,
              kind: input.kind,
            },
          });
          break;
        case "version": {
          const { action: _, ...data } = input;
          void _;
          result = await tx.planVersion.create({
            data: { ...data, effectiveFrom: now },
          });
          break;
        }
        case "key": {
          secret = `bill_${randomBytes(32).toString("base64url")}`;
          result = await tx.productApiKey.create({
            data: {
              productId: input.productId,
              name: input.name,
              scopes: input.scopes,
              prefix: secret.slice(0, 12),
              keyHash: createHash("sha256").update(secret).digest("hex"),
            },
          });
          break;
        }
        case "revokeKey":
          result = await tx.productApiKey.update({
            where: { id: input.id },
            data: { status: "revoked", revokedAt: now },
          });
          break;
      }
      await tx.adminAuditLog.create({
        data: {
          actorIdentityId,
          action: input.action,
          targetType: "catalog",
          targetId: result.id,
          after: { id: result.id },
        },
      });
      return { id: result.id, ...(secret ? { secret } : {}) };
    });
  }
}
