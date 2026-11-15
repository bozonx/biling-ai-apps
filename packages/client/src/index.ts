import {
  walletSchema,
  operationsSchema,
  healthSchema,
  holdSchema,
  entitlementsSchema,
  usageSchema,
} from "@billing/contracts";
export class BillingClient {
  constructor(private readonly baseUrl: string) {}
  private async read(
    path: string,
    apiKey: string,
    body?: unknown,
    key?: string,
  ) {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(key === undefined ? {} : { "Idempotency-Key": key }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Billing HTTP ${response.status}`);
    return response.json();
  }
  async wallet(accountId: string, apiKey: string) {
    return walletSchema.parse(
      await this.read(
        `/api/v1/s2s/wallets/${encodeURIComponent(accountId)}`,
        apiKey,
      ),
    );
  }
  async operations(accountId: string, apiKey: string, before?: string) {
    const query = before ? `?${new URLSearchParams({ before })}` : "";
    return operationsSchema.parse(
      await this.read(
        `/api/v1/s2s/wallets/${encodeURIComponent(accountId)}/operations${query}`,
        apiKey,
      ),
    );
  }
  async reserve(
    input: {
      accountId: string;
      featureId: string;
      amountMilli: string;
      actorId?: string;
      estimatedCostNanos?: string;
    },
    apiKey: string,
    idempotencyKey: string,
  ) {
    return holdSchema.parse(
      await this.read("/api/v1/s2s/holds", apiKey, input, idempotencyKey),
    );
  }
  async reportDiscrepancy(holdId: string, apiKey: string, reason: string) {
    return this.read(
      `/api/v1/s2s/metering/${encodeURIComponent(holdId)}/discrepancy`,
      apiKey,
      { reason },
    );
  }
  async reserveMetered(
    input: {
      accountId: string;
      featureId: string;
      routeId: string;
      meters: Record<string, string>;
      actorId?: string;
    },
    apiKey: string,
    key: string,
  ) {
    const result = (await this.read(
      "/api/v1/s2s/metering/reserve",
      apiKey,
      input,
      key,
    )) as {
      hold: unknown;
      route: {
        id: string;
        provider: string;
        model: string;
        variant: string;
        kind: string;
      };
    };
    return { hold: holdSchema.parse(result.hold), route: result.route };
  }
  async commitMetered(
    holdId: string,
    apiKey: string,
    usage: {
      meters: Record<string, string>;
      providerCostNanos?: string;
      rawUsage?: Record<string, unknown>;
      status?: "ok" | "partial" | "error";
    },
  ) {
    return holdSchema.parse(
      await this.read(
        `/api/v1/s2s/metering/${encodeURIComponent(holdId)}/commit`,
        apiKey,
        usage,
      ),
    );
  }
  async commit(holdId: string, apiKey: string) {
    return holdSchema.parse(
      await this.read(
        `/api/v1/s2s/holds/${encodeURIComponent(holdId)}/commit`,
        apiKey,
        {},
      ),
    );
  }
  async release(holdId: string, apiKey: string) {
    return holdSchema.parse(
      await this.read(
        `/api/v1/s2s/holds/${encodeURIComponent(holdId)}/release`,
        apiKey,
        {},
      ),
    );
  }
  async entitlements(accountId: string, apiKey: string) {
    return entitlementsSchema.parse(
      await this.read(
        `/api/v1/s2s/entitlements/${encodeURIComponent(accountId)}`,
        apiKey,
      ),
    );
  }
  async usage(accountId: string, apiKey: string, before?: string) {
    const query = before ? `?${new URLSearchParams({ before })}` : "";
    return usageSchema.parse(
      await this.read(
        `/api/v1/s2s/usage/${encodeURIComponent(accountId)}${query}`,
        apiKey,
      ),
    );
  }
  async health() {
    const response = await fetch(new URL("/health", this.baseUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Billing HTTP ${response.status}`);
    return healthSchema.parse(await response.json());
  }
}
