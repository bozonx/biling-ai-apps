import { json } from "./json.js";
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  Post,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { walletSchema, operationsSchema } from "@billing/contracts";
import { z } from "zod";
import { Database } from "./database.js";
import { WalletService } from "./wallet.js";
const amount = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const grantSchema = z
  .object({
    accountId: z.uuid(),
    amountMilli: amount,
    creditRateVersionId: z.uuid(),
  })
  .strict();
const reserveSchema = z
  .object({
    accountId: z.uuid(),
    amountMilli: amount,
    featureId: z.uuid(),
    actorId: z.uuid().optional(),
    estimatedCostNanos: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,18})$/)
      .refine((v) => BigInt(v) <= 9223372036854775807n)
      .optional(),
  })
  .strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({ code: "INVALID_REQUEST" });
  return result.data;
}
@Controller("s2s")
export class BillingController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(WalletService) private readonly wallets: WalletService,
  ) {}
  private async authorize(authorization: string | undefined, scope: string) {
    if (!authorization?.startsWith("Bearer "))
      throw new UnauthorizedException({ code: "INVALID_API_KEY" });
    const keyHash = createHash("sha256")
      .update(authorization.slice(7))
      .digest("hex");
    const key = await this.db.productApiKey.findUnique({
      where: { keyHash },
      include: { product: true },
    });
    if (
      !key ||
      key.status !== "active" ||
      key.revokedAt ||
      key.product.status !== "active"
    )
      throw new UnauthorizedException({ code: "INVALID_API_KEY" });
    if (!key.scopes.includes(scope))
      throw new ForbiddenException({ code: "INSUFFICIENT_SCOPE" });
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60_000);
    if (!key.lastUsedAt || key.lastUsedAt < cutoff) {
      await this.db.productApiKey.updateMany({
        where: {
          id: key.id,
          OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }],
        },
        data: { lastUsedAt: now },
      });
    }
    return key.productId;
  }
  private key(value: unknown) {
    return parse(z.string().min(1).max(200), value);
  }
  @Get("entitlements/:accountId")
  async entitlements(
    @Headers("authorization") auth: string | undefined,
    @Param("accountId") accountId: string,
  ) {
    const productId = await this.authorize(auth, "entitlements:read");
    return {
      entitlements: await this.wallets.entitlements(
        parse(z.uuid(), accountId),
        productId,
      ),
    };
  }
  @Get("usage/:accountId")
  async usage(
    @Headers("authorization") auth: string | undefined,
    @Param("accountId") accountId: string,
    @Query("before") before?: string,
  ) {
    const productId = await this.authorize(auth, "usage:read");
    return json(
      await this.wallets.usage(
        parse(z.uuid(), accountId),
        productId,
        before === undefined ? undefined : parse(z.uuid(), before),
      ),
    );
  }
  @Get("wallets/:accountId")
  async balance(
    @Headers("authorization") auth: string | undefined,
    @Param("accountId") accountId: string,
  ) {
    const productId = await this.authorize(auth, "wallets:read");
    return walletSchema.parse(
      json(await this.wallets.balance(parse(z.uuid(), accountId), productId)),
    );
  }
  @Get("wallets/:accountId/operations")
  async history(
    @Headers("authorization") auth: string | undefined,
    @Param("accountId") accountId: string,
    @Query("before") before?: string,
  ) {
    const productId = await this.authorize(auth, "wallets:read");
    const cursor =
      before === undefined
        ? undefined
        : parse(z.string().regex(/^[1-9][0-9]{0,18}$/), before);
    return operationsSchema.parse(
      json(
        await this.wallets.history(
          parse(z.uuid(), accountId),
          productId,
          cursor,
        ),
      ),
    );
  }
  @Post("credits/grant")
  async grant(
    @Headers("authorization") auth: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    const productId = await this.authorize(auth, "credits:grant");
    return json(
      await this.wallets.grant(
        productId,
        this.key(key),
        parse(grantSchema, body),
      ),
    );
  }
  @Post("holds")
  async reserve(
    @Headers("authorization") auth: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    const productId = await this.authorize(auth, "holds:write");
    return json(
      await this.wallets.reserve(
        productId,
        this.key(key),
        parse(reserveSchema, body),
      ),
    );
  }
  @Post("holds/:holdId/:action")
  async close(
    @Headers("authorization") auth: string | undefined,
    @Param("holdId") holdId: string,
    @Param("action") action: string,
    @Body() body?: unknown,
  ) {
    const productId = await this.authorize(auth, "holds:write");
    return json(
      await this.wallets.close(
        productId,
        parse(z.uuid(), holdId),
        parse(z.enum(["commit", "release"]), action),
        body === undefined ||
          (typeof body === "object" &&
            body !== null &&
            Object.keys(body).length === 0)
          ? undefined
          : parse(
              z
                .object({
                  creditsMilli: z
                    .string()
                    .regex(/^(0|[1-9][0-9]{0,18})$/)
                    .transform(BigInt),
                  costNanos: z
                    .string()
                    .regex(/^(0|[1-9][0-9]{0,18})$/)
                    .refine((v) => BigInt(v) <= 9223372036854775807n)
                    .transform(BigInt),
                })
                .strict(),
              body,
            ),
      ),
    );
  }
}
