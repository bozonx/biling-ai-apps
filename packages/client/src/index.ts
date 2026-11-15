import { healthSchema } from "../../contracts/src";
export class BillingClient {
  constructor(private readonly baseUrl: string) {}
  async health() {
    const response = await fetch(new URL("/health", this.baseUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Billing HTTP ${response.status}`);
    return healthSchema.parse(await response.json());
  }
}
