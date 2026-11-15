import { providerUsage } from "./provider-usage.js";
import { Catalog, createAiKit } from "@bozonx/ai-kit";
import type { Delivery } from "./outbox.js";

export class ProviderRejected extends Error {}
export type Route = {
  provider: string;
  model: string;
  kind: string;
  variant: string;
};
export async function generate(
  route: Route,
  messages: { role: "user" | "assistant"; content: string }[],
  maxOutputTokens: number,
  keys: Record<string, string | undefined>,
  transport: typeof fetch = fetch,
  capture?: (usage: NonNullable<Delivery["usage"]>) => Promise<void>,
) {
  if (route.kind !== "llm" || route.variant !== "standard")
    throw new ProviderRejected("UNSUPPORTED_ROUTE");
  if (!keys[route.provider])
    throw new ProviderRejected("PROVIDER_NOT_CONFIGURED");
  let rejected = false;
  let rawUsage: Record<string, unknown> | undefined;
  const catalog = Catalog.fromObject({
    models: [
      {
        name: "selected",
        provider: route.provider,
        model: route.model,
        tier: "standard",
        contextSize: 1000000,
        maxOutputTokens: 65536,
        modalities: { input: ["text"], output: ["text"] },
        capabilities: {
          tools: false,
          structuredOutput: false,
          promptCaching: false,
        },
      },
    ],
    requirePricing: false,
    taskClasses: { chat: ["selected"] },
  });
  const kit = createAiKit({
    catalog,
    keys: {
      get: async (provider) => {
        const key = keys[provider];
        if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");
        return key;
      },
    },
    retry: { maxRetriesPerCandidate: 0 },
    transport: {
      fetch: async (input, init) => {
        const response = await transport(input, init);
        if (!response.ok) rejected = true;
        if (response.ok) {
          const body = (await response.clone().json()) as {
            usage?: Record<string, unknown>;
            usageMetadata?: Record<string, unknown>;
          };
          rawUsage = body.usage ?? body.usageMetadata;
          if (rawUsage && capture)
            await capture(providerUsage(route.provider, rawUsage));
        }
        return response;
      },
    },
  });
  const result = await kit
    .generate({
      policy: { taskClass: "chat", requestedModel: "selected" },
      messages,
      maxOutputTokens,
    })
    .catch((error) => {
      if (rejected) throw new ProviderRejected("Provider rejected request");
      throw error;
    });
  if (!rawUsage) throw new Error("MISSING_PROVIDER_USAGE");
  const usage = providerUsage(route.provider, rawUsage);
  return { response: { text: result.text }, usage };
}
