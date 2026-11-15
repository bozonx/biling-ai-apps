import tseslint from "typescript-eslint";
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
);
