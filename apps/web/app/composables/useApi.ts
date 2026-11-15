import type { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * HTTP client for the billing API behind the same-origin /api/v1 proxy.
 * Responses are validated with the shared Zod contracts.
 */
export function useApi() {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: Method;
      body?: unknown;
      query?: Record<string, unknown>;
    } = {},
  ): Promise<T> {
    let data: unknown;
    try {
      data = await $fetch(path, {
        baseURL: "/api/v1",
        method: options.method ?? "GET",
        body: options.body as Record<string, unknown> | undefined,
        query: options.query,
      });
    } catch (cause) {
      throw toApiError(cause);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiError("INVALID_RESPONSE");
    return parsed.data;
  }

  return {
    get: <T>(
      path: string,
      schema: z.ZodType<T>,
      query?: Record<string, unknown>,
    ) => request(path, schema, { query }),
    request,
  };
}
