import { z } from "zod";
const optionalApiKey = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

export const gatewayConfigSchema = z.object({
  GEMINI_API_KEY: optionalApiKey,
  OPENROUTER_API_KEY: optionalApiKey,
  OPENAI_API_KEY: optionalApiKey,
  ANTHROPIC_API_KEY: optionalApiKey,
  DEEPGRAM_API_KEY: optionalApiKey,
  GROQ_API_KEY: optionalApiKey,
  DATABASE_URL: z.url(),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().max(65535),
  GATEWAY_PORT: z.coerce.number().int().positive().max(65535),
});

export const config = gatewayConfigSchema.parse(process.env);
