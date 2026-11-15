import {
  walletSchema,
  operationsSchema,
  healthSchema,
} from "@billing/contracts";
export class BillingClient {
  constructor(private readonly baseUrl: string) {}
  private async read(path: string, apiKey: string) {
    const response = await fetch(new URL(path, this.baseUrl), {
      headers: { Authorization: `Bearer ${apiKey}` },
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
  async health() {
    const response = await fetch(new URL("/health", this.baseUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Billing HTTP ${response.status}`);
    return healthSchema.parse(await response.json());
  }
}
