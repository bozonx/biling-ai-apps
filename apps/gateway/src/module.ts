import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Post,
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { timingSafeEqual, createHash } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { BillingClient } from "@billing/client";
import { config } from "./config.js";
import { CommitOutbox } from "./outbox.js";
import { generate, ProviderRejected } from "./generation.js";

@Injectable()
export class GatewayService implements OnModuleInit, OnModuleDestroy {
  readonly billing = new BillingClient(config.BILLING_API_URL);
  readonly pool = new Pool({ connectionString: config.DATABASE_URL });
  readonly outbox = new CommitOutbox(
    this.pool,
    this.billing,
    config.BILLING_API_KEY ?? "",
  );
  timer?: ReturnType<typeof setInterval>;
  async onModuleInit() {
    await this.outbox.initialize();
    this.timer = setInterval(() => {
      void this.outbox.flush().catch(() => undefined);
    }, 2000);
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.pool.end();
  }
  async call(
    key: string,
    input: {
      accountId: string;
      featureId: string;
      routeId: string;
      messages: { role: "user" | "assistant"; content: string }[];
      maxOutputTokens: number;
    },
  ) {
    if (!config.BILLING_API_KEY)
      throw new ServiceUnavailableException({ code: "GATEWAY_NOT_CONFIGURED" });
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const existing = await this.pool.query(
      `SELECT fingerprint,response FROM gateway.commit_outbox WHERE request_key=$1`,
      [key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].fingerprint !== fingerprint)
        throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT" });
      if (existing.rows[0].response) {
        if (existing.rows[0].response.error)
          throw new ServiceUnavailableException({ code: "PROVIDER_FAILED" });
        return existing.rows[0].response as unknown;
      }
      throw new ConflictException({ code: "REQUEST_IN_PROGRESS" });
    }
    const estimatedInput =
      input.messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0) +
      input.messages.length * 32;
    const { hold, route } = await this.billing.reserveMetered(
      {
        accountId: input.accountId,
        featureId: input.featureId,
        routeId: input.routeId,
        meters: {
          input_tokens: String(estimatedInput),
          output_tokens: String(input.maxOutputTokens),
        },
      },
      config.BILLING_API_KEY,
      key,
    );
    const prior = await this.outbox.begin(key, fingerprint, hold.id);
    if (!prior.created) {
      if (prior.response) {
        if ((prior.response as { error?: unknown }).error)
          throw new ServiceUnavailableException({ code: "PROVIDER_FAILED" });
        return prior.response;
      }
      throw new ConflictException({ code: "REQUEST_IN_PROGRESS" });
    }
    let result;
    let captured = false;
    let capturedUsage:
      Parameters<BillingClient["commitMetered"]>[2] | undefined;
    try {
      result = await generate(
        route,
        input.messages,
        input.maxOutputTokens,
        {
          google: config.GEMINI_API_KEY,
          openrouter: config.OPENROUTER_API_KEY,
          openai: config.OPENAI_API_KEY,
          anthropic: config.ANTHROPIC_API_KEY,
          groq: config.GROQ_API_KEY,
        },
        fetch,
        async (usage) => {
          capturedUsage = usage;
          await this.outbox.enqueue(
            key,
            {
              holdId: hold.id,
              action: "commit",
              usage,
            },
            null,
          );
          captured = true;
        },
      );
    } catch (error) {
      if (capturedUsage)
        await this.outbox.enqueue(
          key,
          {
            holdId: hold.id,
            action: "commit",
            usage: { ...capturedUsage, status: "partial" },
          },
          { error: { code: "PROVIDER_FAILED" } },
        );
      if (!captured && error instanceof ProviderRejected)
        await this.outbox.enqueue(
          key,
          {
            holdId: hold.id,
            action: "commit",
            usage: {
              meters: {},
              status: "error",
              ...(route.provider === "openrouter"
                ? { providerCostNanos: "0" }
                : {}),
            },
          },
          { error: { code: "PROVIDER_FAILED" } },
        );
      else if (!captured)
        await this.billing
          .reportDiscrepancy(
            hold.id,
            config.BILLING_API_KEY,
            "provider_outcome_unknown",
          )
          .catch(() => undefined);
      throw new ServiceUnavailableException({ code: "PROVIDER_FAILED" });
    }
    await this.outbox.enqueue(
      key,
      { holdId: hold.id, action: "commit", usage: result.usage },
      result.response,
    );
    void this.outbox.flush().catch(() => undefined);
    return result.response;
  }
}
@Controller()
export class GatewayController {
  constructor(@Inject(GatewayService) readonly service: GatewayService) {}
  @Get("health") health() {
    return { status: "ok", service: "gateway" };
  }
  @Post("generate") async generate(
    @Headers("authorization") auth: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
  ) {
    const supplied = Buffer.from(auth?.replace(/^Bearer /, "") ?? "");
    const expected = Buffer.from(config.GATEWAY_API_KEY ?? "");
    if (
      !expected.length ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new UnauthorizedException({ code: "INVALID_API_KEY" });
    const parsed = z
      .object({
        accountId: z.uuid(),
        featureId: z.uuid(),
        routeId: z.uuid(),
        messages: z
          .array(
            z
              .object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(100000),
              })
              .strict(),
          )
          .min(1)
          .max(100),
        maxOutputTokens: z.number().int().min(1).max(65536),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success || !key || !/^[a-zA-Z0-9_-]{1,120}$/.test(key))
      throw new BadRequestException({ code: "INVALID_REQUEST" });
    return this.service.call(key, parsed.data);
  }
}
@Module({ providers: [GatewayService], controllers: [GatewayController] })
export class AppModule {}
