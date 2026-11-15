export type ThemePreference = "system" | "light" | "dark";

/** Theme choices shared by the header switcher and the settings page. */
export function useThemeOptions() {
  const { t } = useI18n();
  const colorMode = useColorMode();
  const options = computed(() => [
    {
      value: "system" as const,
      label: t("theme.system"),
      icon: "i-lucide-monitor",
    },
    { value: "light" as const, label: t("theme.light"), icon: "i-lucide-sun" },
    { value: "dark" as const, label: t("theme.dark"), icon: "i-lucide-moon" },
  ]);
  const preference = computed<ThemePreference>({
    get: () => colorMode.preference as ThemePreference,
    set: (value) => (colorMode.preference = value),
  });
  const current = computed(
    () =>
      options.value.find((option) => option.value === preference.value) ??
      options.value[0]!,
  );
  return { options, preference, current };
}

/** Interface language choices; setLocale also persists the cookie. */
export function useLocaleOptions() {
  const { locale, locales, setLocale } = useI18n();
  const options = computed(() =>
    locales.value.map((item) => ({
      value: item.code,
      label: item.name ?? item.code,
      short: item.code === "en-US" ? "US" : item.code.toUpperCase(),
    })),
  );
  const current = computed(
    () =>
      options.value.find((option) => option.value === locale.value) ??
      options.value[0]!,
  );
  return { options, locale, current, setLocale };
}
