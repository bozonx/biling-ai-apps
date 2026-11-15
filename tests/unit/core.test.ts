import { displayCredits } from "../../packages/core/src";
test("rounds down without losing bigint precision", () => {
  expect(displayCredits(9007199254740993999n)).toBe(9007199254740993n);
  expect(displayCredits(999n)).toBe(0n);
});
test("rejects negative balances", () => {
  expect(() => displayCredits(-1n)).toThrow(RangeError);
});
