export default defineNuxtConfig({
  compatibilityDate: "2026-11-15",
  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxtjs/i18n", "@nuxt/icon"],
  // The portal has nothing to render before the session is known.
  ssr: false,
  app: {
    head: {
      title: "Billing AI",
      meta: [{ name: "robots", content: "noindex, nofollow" }],
    },
  },
  runtimeConfig: {
    // Server-only: where the Nitro proxy forwards /api/v1/** (NUXT_API_URL).
    apiUrl: "http://localhost:3001",
    public: {
      // Product name shown in the UI (NUXT_PUBLIC_APP_NAME).
      appName: "Billing AI",
      // Shows the developer sign-in button (NUXT_PUBLIC_DEV_LOGIN_ENABLED).
      devLoginEnabled: false,
    },
  },
  i18n: {
    strategy: "no_prefix",
    defaultLocale: "ru",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "billing_locale",
      fallbackLocale: "ru",
    },
    locales: [
      { code: "ru", language: "ru", name: "Русский", file: "ru.json" },
      {
        code: "en-US",
        language: "en-US",
        name: "English (US)",
        file: "en-US.json",
      },
    ],
  },
  colorMode: { preference: "system", storageKey: "billing-color-mode" },
  css: ["~/assets/main.css"],
  devtools: { enabled: false },
});
