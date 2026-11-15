export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

const KNOWN_CODES = new Set([
  "INVALID_REQUEST",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "NETWORK_ERROR",
  "INVALID_RESPONSE",
  "DEV_LOGIN_UNAVAILABLE",
  "SERVER_ERROR",
]);

/** Normalizes any thrown value into an ApiError with a stable code. */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  const error = cause as {
    statusCode?: number;
    response?: { status?: number };
    data?: { code?: unknown };
  };
  const status = error?.response?.status ?? error?.statusCode;
  const code =
    typeof error?.data?.code === "string" ? error.data.code : undefined;
  if (code) return new ApiError(code, status);
  if (status === undefined) return new ApiError("NETWORK_ERROR");
  if (status === 401 || status === 403)
    return new ApiError("UNAUTHORIZED", status);
  if (status === 404) return new ApiError("NOT_FOUND", status);
  if (status >= 500) return new ApiError("SERVER_ERROR", status);
  return new ApiError("INVALID_REQUEST", status);
}

/** i18n key for an error; raw backend text is never shown. */
export function errorMessageKey(error: unknown): string {
  const { code } = toApiError(error);
  return KNOWN_CODES.has(code) ? `errors.${code}` : "errors.UNKNOWN";
}
