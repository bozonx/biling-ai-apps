export default defineNuxtConfig({
  compatibilityDate: "2026-11-15",
  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxtjs/i18n", "@nuxt/icon"],
  i18n: {
    strategy: "no_prefix",
    defaultLocale: "en",
    locales: [{ code: "en", language: "en" }],
  },
  css: ["~/assets/main.css"],
  devtools: { enabled: false },
});
