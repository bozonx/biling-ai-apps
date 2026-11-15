import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
export default tseslint.config(
  {
    ignores: [
      "**/generated/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/dist/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: [
      "apps/api/src/**/*.ts",
      "apps/gateway/src/**/*.ts",
      "packages/*/src/**/*.ts",
      "prisma/**/*.ts",
      "tests/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  prettier,
);
