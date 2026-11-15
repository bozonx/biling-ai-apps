export default defineNuxtConfig({
  compatibilityDate: "2026-11-15",
  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxtjs/i18n", "@nuxt/icon"],
  i18n: {
    strategy: "no_prefix",
    defaultLocale: "ru",
    locales: [
      { code: "ru", language: "ru", file: "ru.json" },
      { code: "en-US", language: "en-US", file: "en-US.json" },
    ],
  },
  css: ["~/assets/main.css"],
  devtools: { enabled: false },
});
