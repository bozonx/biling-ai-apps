import { WalletService } from "./wallet.js";
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Inject,
  BadRequestException,
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
const actionSchema = z.discriminatedUnion("action", [
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
  @Get("catalog")
  async catalog(@Headers("authorization") auth?: string) {
    await this.staff.authorize(auth);
    const [products, features, prices, rates, plans, versions, keys] =
      await Promise.all([
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
      ]);
    return json({ products, features, prices, rates, plans, versions, keys });
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
              publishedAt: now,
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
            data: { ...data, publishedAt: now, effectiveFrom: now },
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
