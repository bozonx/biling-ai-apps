import {
  allocateCredits,
  estimateCredits,
} from "../../packages/core/src/index.js";
const now = new Date("2026-01-01Z");
test("prices tiny calls and large amounts without floating point", () => {
  expect(estimateCredits(1n, 1000n)).toBe(1n);
  expect(estimateCredits(1000000000n, 10000n)).toBe(100000n);
  expect(estimateCredits(90071992547409930001n, 10n)).toBe(
    9007199254740993001n,
  );
  expect(() => estimateCredits(1n, 0n)).toThrow();
});
test("allocates earliest expiry first and excludes expired credits without mutating input", () => {
  const buckets = [
    { id: "permanent", remainingMilli: 100n, expiresAt: null },
    { id: "expired", remainingMilli: 100n, expiresAt: now },
    { id: "expiring", remainingMilli: 20n, expiresAt: new Date("2027-01-01Z") },
  ];
  expect(allocateCredits(buckets, 30n, now)).toEqual([
    { bucketId: "expiring", amountMilli: 20n },
    { bucketId: "permanent", amountMilli: 10n },
  ]);
  expect(buckets[0]?.remainingMilli).toBe(100n);
  expect(() => allocateCredits(buckets, 121n, now)).toThrow(
    "Insufficient credits",
  );
  expect(() => allocateCredits(buckets, 0n, now)).toThrow();
});

test("equal expiry follows billing source priority", () => {
  expect(
    allocateCredits(
      [
        { id: "a", kind: "pack", remainingMilli: 100n, expiresAt: null },
        { id: "z", kind: "plan", remainingMilli: 100n, expiresAt: null },
      ],
      50n,
      now,
    ),
  ).toEqual([{ bucketId: "z", amountMilli: 50n }]);
});
