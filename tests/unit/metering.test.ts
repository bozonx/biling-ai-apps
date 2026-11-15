import { routeCost } from "../../apps/api/src/metering.js";
import {
  providerUsage,
  usdToNanos,
} from "../../apps/gateway/src/provider-usage.js";
import {
  generate,
  ProviderRejected,
} from "../../apps/gateway/src/generation.js";
import nock from "nock";

afterEach(() => {
  nock.cleanAll();
});
test("prices tiers, minimum units and nano rounding", () => {
  const item = {
    meter: "input_tokens",
    unitNanos: 3n,
    per: 2n,
    minBillableUnits: null,
    tier: null,
  };
  expect(routeCost([item], { input_tokens: "1" })).toBe(2n);
  expect(
    routeCost(
      [item, { ...item, unitNanos: 6n, tier: { fromContextTokens: 10 } }],
      { input_tokens: "10" },
    ),
  ).toBe(30n);
  expect(
    routeCost([{ ...item, meter: "audio_seconds", minBillableUnits: 10n }], {
      audio_seconds: "1",
    }),
  ).toBe(15n);
  expect(() => routeCost([item], { images: "1" })).toThrow();
});
test("normalizes cache and thinking without charging tokens twice", () => {
  expect(
    providerUsage("google", {
      promptTokenCount: 10,
      cachedContentTokenCount: 4,
      candidatesTokenCount: 2,
      thoughtsTokenCount: 3,
    }).meters,
  ).toEqual({
    input_tokens: "6",
    cached_input_tokens: "4",
    output_tokens: "5",
  });
  expect(
    providerUsage("openrouter", {
      prompt_tokens: 10,
      completion_tokens: 4,
      cost: 0.000001,
    }).providerCostNanos,
  ).toBe("1000");
  expect(() =>
    providerUsage("openrouter", { prompt_tokens: 1, completion_tokens: 1 }),
  ).toThrow();
});
test("ai-kit calls Google and persists usage before returning an answer", async () => {
  const scope = nock("https://generativelanguage.googleapis.com")
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
  const captured: unknown[] = [];
  const result = await generate(
    {
      provider: "google",
      model: "gemini-2.5-flash",
      kind: "llm",
      variant: "standard",
    },
    [{ role: "user", content: "Hello" }],
    20,
    { google: "test-key" },
    fetch,
    async (usage) => {
      captured.push(usage);
    },
  );
  expect(result.response.text).toBe("Hello");
  expect(captured).toHaveLength(1);
  expect(result.usage.meters).toEqual({
    input_tokens: "10",
    output_tokens: "3",
  });
  expect(scope.isDone()).toBe(true);
});
test("provider rejection can release the hold", async () => {
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
    generate(
      {
        provider: "google",
        model: "gemini-2.5-flash",
        kind: "llm",
        variant: "standard",
      },
      [{ role: "user", content: "Hello" }],
      20,
      { google: "test-key" },
    ),
  ).rejects.toBeInstanceOf(ProviderRejected);
});

test("ai-kit preserves the actual OpenRouter cost", async () => {
  const scope = nock("https://openrouter.ai")
    .post("/api/v1/chat/completions")
    .reply(200, {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1,
      model: "test/model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 3,
        total_tokens: 13,
        cost: 0.000012345,
      },
    });
  const result = await generate(
    {
      provider: "openrouter",
      model: "test/model",
      kind: "llm",
      variant: "standard",
    },
    [{ role: "user", content: "Hello" }],
    20,
    { openrouter: "test-key" },
  );
  expect(result.usage.providerCostNanos).toBe("12345");
  expect(scope.isDone()).toBe(true);
});

test("converts provider USD decimals to nanos without float multiplication", () => {
  expect(usdToNanos(0.0000000001)).toBe("1");
  expect(usdToNanos(0.000123456789)).toBe("123457");
  expect(usdToNanos(1)).toBe("1000000000");
  expect(() => usdToNanos(Infinity)).toThrow();
});
