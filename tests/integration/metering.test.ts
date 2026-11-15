import "reflect-metadata";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Module } from "@nestjs/common";
import { Database } from "../../apps/api/src/database.js";
import { WalletService } from "../../apps/api/src/wallet.js";
import { BillingController } from "../../apps/api/src/billing-controller.js";
import nock from "nock";

@Module({
  providers: [Database, WalletService],
  controllers: [BillingController],
})
class TestApiModule {}

test("gateway reserves, records provider usage durably and retries commit across a restart", async () => {
  if (nock.isActive()) nock.restore();
  const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
  const previous = { ...process.env };
  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.GATEWAY_PORT = "3011";
  process.env.BILLING_API_KEY = "test-product-key";
  process.env.GATEWAY_API_KEY = "test-gateway-key";
  process.env.GEMINI_API_KEY = "test-google-key";
  let api: NestFastifyApplication | undefined;
  let gateway: NestFastifyApplication | undefined;
  try {
    execFileSync("pnpm", ["db:deploy"], { env: process.env, stdio: "pipe" });
    api = await NestFactory.create<NestFastifyApplication>(
      TestApiModule,
      new FastifyAdapter(),
      { logger: false },
    );
    api.setGlobalPrefix("api/v1");
    await api.listen(0, "127.0.0.1");
    process.env.BILLING_API_URL = await api.getUrl();
    const db = api.get(Database);
    const wallets = api.get(WalletService);
    const product = await db.product.create({
      data: { code: "tyco-metering", name: "TyCo" },
    });
    await db.productApiKey.create({
      data: {
        productId: product.id,
        prefix: "test",
        keyHash: createHash("sha256").update("test-product-key").digest("hex"),
        scopes: ["holds:write"],
      },
    });
    const identity = await db.identity.create({ data: {} });
    const account = await db.billingAccount.create({
      data: { ownerIdentityId: identity.id, personalOwnerId: identity.id },
    });
    const now = new Date();
    const rate = await db.creditRateVersion.create({
      data: {
        productId: product.id,
        version: 1,
        creditValueMicros: 1000n,
        effectiveFrom: now,
        publishedAt: now,
      },
    });
    await db.markupPolicyVersion.create({
      data: {
        productId: product.id,
        version: 1,
        tiers: [{ fromCostNanos: "0", multiplierBps: 20000 }],
        effectiveFrom: now,
        publishedAt: now,
      },
    });
    const route = await db.modelRoute.create({
      data: { provider: "google", model: "gemini-2.5-flash", kind: "llm" },
    });
    await db.productModelRoute.create({
      data: { productId: product.id, routeId: route.id },
    });
    await db.routePriceVersion.create({
      data: {
        routeId: route.id,
        version: 1,
        source: "manual",
        effectiveFrom: now,
        items: {
          create: [
            { meter: "input_tokens", unitNanos: 1000n, per: 1n },
            { meter: "output_tokens", unitNanos: 2000n, per: 1n },
          ],
        },
      },
    });
    const draft = await db.routePriceVersion.findFirstOrThrow({
      where: { routeId: route.id },
    });
    await db.routePriceVersion.update({
      where: { id: draft.id },
      data: { publishedAt: now },
    });
    const feature = await db.productFeature.create({
      data: { productId: product.id, key: "chat", pricing: "metered" },
    });
    await wallets.grant(product.id, "seed", {
      accountId: account.id,
      amountMilli: "100000",
      creditRateVersionId: rate.id,
    });
    const { AppModule, GatewayService } =
      await import("../../apps/gateway/src/module.js");
    gateway = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    gateway.setGlobalPrefix("api/v1");
    await gateway.listen(0, "127.0.0.1");
    const service = gateway.get(GatewayService);
    if (service.timer) clearInterval(service.timer);
    nock.activate();
    const outage = nock(await api.getUrl(), { allowUnmocked: true })
      .persist()
      .post(/\/metering\/.*\/commit/)
      .reply(503, {});
    const provider = nock("https://generativelanguage.googleapis.com")
      .post(/generateContent/)
      .reply(200, {
        candidates: [
          {
            content: { role: "model", parts: [{ text: "Hello" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 3,
          totalTokenCount: 13,
        },
      });
    const input = {
      accountId: account.id,
      featureId: feature.id,
      routeId: route.id,
      messages: [{ role: "user", content: "Hello" }],
      maxOutputTokens: 20,
    };
    const response = await fetch(`${await gateway.getUrl()}/api/v1/generate`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-gateway-key",
        "idempotency-key": "request-1",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ text: "Hello" });
    expect(provider.isDone()).toBe(true);
    await service.outbox.flush();
    expect(await db.usageEvent.count()).toBe(0);
    const pending = await service.pool.query(
      `SELECT * FROM gateway.commit_outbox WHERE request_key='request-1'`,
    );
    expect(pending.rows[0].state).toBe("pending");
    outage.persist(false);
    nock.cleanAll();
    await gateway.close();
    gateway = undefined;
    gateway = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    gateway.setGlobalPrefix("api/v1");
    await gateway.listen(0, "127.0.0.1");
    const restarted = gateway.get(GatewayService);
    if (restarted.timer) clearInterval(restarted.timer);
    await restarted.pool.query(
      `UPDATE gateway.commit_outbox SET next_attempt_at=now()`,
    );
    await restarted.outbox.flush();
    const usage = await db.usageEvent.findFirstOrThrow();
    expect(usage).toMatchObject({
      costNanos: 16000n,
      creditsChargedMilli: 32n,
      costSource: "price_table",
      routeId: route.id,
      isLate: false,
    });
    expect(await wallets.balance(account.id, product.id)).toMatchObject({
      balanceMilli: 99968n,
      heldMilli: 0n,
    });
    const repeated = await restarted.call(
      "request-1",
      input as Parameters<typeof restarted.call>[1],
    );
    expect(repeated).toEqual({ text: "Hello" });
    expect(await db.usageEvent.count()).toBe(1);
    nock("https://generativelanguage.googleapis.com")
      .post(/generateContent/)
      .reply(400, {
        error: {
          message: "Invalid request",
          status: "INVALID_ARGUMENT",
          code: 400,
        },
      });
    await expect(
      restarted.call(
        "provider-rejected",
        input as Parameters<typeof restarted.call>[1],
      ),
    ).rejects.toThrow();
    await restarted.outbox.flush();
    expect(await wallets.balance(account.id, product.id)).toMatchObject({
      heldMilli: 0n,
      balanceMilli: 99968n,
    });
    expect(
      await db.creditHold.findFirst({
        where: { idempotencyKey: "provider-rejected" },
      }),
    ).toMatchObject({ status: "released" });
    const late = await wallets.reserveMetered(product.id, "late", {
      accountId: account.id,
      featureId: feature.id,
      routeId: route.id,
      meters: { input_tokens: "1", output_tokens: "1" },
    });
    await db.creditHold.update({
      where: { id: late.hold.id },
      data: { expiresAt: new Date(0) },
    });
    await wallets.expireHolds();
    await wallets.close(product.id, late.hold.id, "commit", undefined, {
      meters: { input_tokens: "2", output_tokens: "2" },
      status: "ok",
    });
    expect(
      await db.usageEvent.findFirst({ where: { holdId: late.hold.id } }),
    ).toMatchObject({ isLate: true, creditsChargedMilli: 12n });
    expect(
      await db.adminTask.count({
        where: { dedupeKey: `metering:${late.hold.id}` },
      }),
    ).toBe(1);
    await wallets.close(product.id, late.hold.id, "commit", undefined, {
      meters: { output_tokens: "2", input_tokens: "2" },
      status: "ok",
    });
    await expect(
      wallets.close(product.id, late.hold.id, "commit", undefined, {
        meters: { input_tokens: "3", output_tokens: "2" },
        status: "ok",
      }),
    ).rejects.toThrow();
    const released = await wallets.reserveMetered(product.id, "released-late", {
      accountId: account.id,
      featureId: feature.id,
      routeId: route.id,
      meters: { input_tokens: "1", output_tokens: "1" },
    });
    await wallets.close(product.id, released.hold.id, "release");
    await wallets.close(product.id, released.hold.id, "commit", undefined, {
      meters: { input_tokens: "0", output_tokens: "0" },
      status: "partial",
    });
    expect(
      await db.usageEvent.findFirst({ where: { holdId: released.hold.id } }),
    ).toMatchObject({ isLate: true, status: "partial" });
    const zero = await wallets.reserveMetered(product.id, "zero", {
      accountId: account.id,
      featureId: feature.id,
      routeId: route.id,
      meters: { input_tokens: "1", output_tokens: "1" },
    });
    await wallets.close(product.id, zero.hold.id, "commit", undefined, {
      meters: { input_tokens: "0", output_tokens: "0" },
      status: "ok",
    });
    expect(
      await db.usageEvent.findFirst({ where: { holdId: zero.hold.id } }),
    ).toMatchObject({ creditsChargedMilli: 0n, costNanos: 0n });
    const small = await wallets.reserveMetered(product.id, "debt", {
      accountId: account.id,
      featureId: feature.id,
      routeId: route.id,
      meters: { input_tokens: "1", output_tokens: "1" },
    });
    const changed = await db.routePriceVersion.create({
      data: {
        routeId: route.id,
        version: 2,
        source: "manual",
        effectiveFrom: new Date(),
        items: {
          create: [
            { meter: "input_tokens", unitNanos: 9000n, per: 1n },
            { meter: "output_tokens", unitNanos: 9000n, per: 1n },
          ],
        },
      },
    });
    const changedAt = new Date();
    await db.routePriceVersion.update({
      where: { id: changed.id },
      data: { publishedAt: changedAt, effectiveFrom: changedAt },
    });
    await db.creditRateVersion.create({
      data: {
        productId: product.id,
        version: 2,
        creditValueMicros: 100n,
        effectiveFrom: changedAt,
        publishedAt: changedAt,
      },
    });
    const balance = await wallets.balance(account.id, product.id);
    const protectedHold = await wallets.reserve(product.id, "protected", {
      accountId: account.id,
      featureId: feature.id,
      amountMilli: (balance.balanceMilli - small.hold.amountMilli).toString(),
    });
    await db.creditHold.update({
      where: { id: small.hold.id },
      data: { expiresAt: new Date(0) },
    });
    await wallets.expireHolds();
    await wallets.close(product.id, small.hold.id, "commit", undefined, {
      meters: { input_tokens: "100", output_tokens: "100" },
      status: "partial",
    });
    expect(await wallets.balance(account.id, product.id)).toMatchObject({
      heldMilli: protectedHold.amountMilli,
      balanceMilli: protectedHold.amountMilli,
      debtMilli: 594n,
    });
    expect(
      await db.creditLedgerEntry.findFirst({
        where: { holdId: small.hold.id, reason: "debt" },
      }),
    ).toMatchObject({ amountMilli: 594n });
    const debtLedger = await db.creditLedgerEntry.aggregate({
      where: { accountId: account.id, productId: product.id, reason: "debt" },
      _sum: { amountMilli: true },
    });
    expect(debtLedger._sum.amountMilli).toBe(594n);
  } finally {
    nock.cleanAll();
    if (nock.isActive()) nock.restore();
    if (gateway) await gateway.close();
    if (api) await api.close();
    await postgres.stop();
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}, 120000);
