import { expect, test } from "vitest";
import { healthSchema } from "../../../packages/contracts/src";
test("accepts the public health contract", () => {
  expect(healthSchema.parse({ status: "ok", service: "api" }).status).toBe(
    "ok",
  );
});
