const base = {
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  preset: "ts-jest",
  testEnvironment: "node",
};
module.exports = {
  testTimeout: 120000,
  projects: [
    {
      ...base,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    },
    {
      ...base,
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 120000,
    },
  ],
};
