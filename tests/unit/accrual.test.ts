import {
  accrualBoundary,
  applyCreditGrant,
} from "../../packages/core/src/index.js";

it("clamps monthly boundaries without moving the original anchor", () => {
  const anchor = new Date("2024-01-31T12:00:00Z");
  expect(accrualBoundary(anchor, "month", 1, 1).toISOString()).toBe(
    "2024-02-29T12:00:00.000Z",
  );
  expect(accrualBoundary(anchor, "month", 1, 2).toISOString()).toBe(
    "2024-03-31T12:00:00.000Z",
  );
});

it("repays debt before exposing grant credits", () => {
  expect(applyCreditGrant(100n, 150n)).toEqual({
    repayment: 100n,
    available: 0n,
  });
  expect(applyCreditGrant(150n, 100n)).toEqual({
    repayment: 100n,
    available: 50n,
  });
  expect(() => applyCreditGrant(1n, -1n)).toThrow(RangeError);
});
