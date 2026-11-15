import pino from "pino";
import type { LoggerService } from "@nestjs/common";
export const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "authorization",
      "secret",
      "keyHash",
      "token",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: String(req.url ?? "").split("?")[0],
    }),
  },
});
export const nestLogger: LoggerService = {
  log: (message) => logger.info({ context: "Nest" }, String(message)),
  error: () => logger.error({ context: "Nest" }, "Application error"),
  warn: (message) => logger.warn({ context: "Nest" }, String(message)),
  debug: (message) => logger.debug({ context: "Nest" }, String(message)),
  verbose: (message) => logger.trace({ context: "Nest" }, String(message)),
};
