import { expect, test } from "vitest";
import { healthSchema } from "@billing/contracts";
test("accepts the public health contract", () => {
  expect(healthSchema.parse({ status: "ok", service: "api" }).status).toBe(
    "ok",
  );
});
