import { z } from "zod";
export const config = z
  .object({
    DATABASE_URL: z.url(),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive().max(65535),
    API_PORT: z.coerce.number().int().positive().max(65535),
  })
  .parse(process.env);
