<script setup lang="ts">
/** `menu`: compact dropdown for the header; `select`: full select for settings. */
withDefaults(defineProps<{ variant?: "menu" | "select" }>(), {
  variant: "menu",
});
const { t } = useI18n();
const { options, locale, current, setLocale } = useLocaleOptions();
const items = computed(() =>
  options.value.map((option) => ({
    label: option.label,
    type: "checkbox" as const,
    checked: locale.value === option.value,
    onSelect: () => setLocale(option.value),
  })),
);
</script>

<template>
  <USelect
    v-if="variant === 'select'"
    :model-value="locale"
    :items="options"
    value-key="value"
    class="w-48"
    icon="i-lucide-languages"
    :aria-label="t('language.title')"
    @update:model-value="(value) => setLocale(value as typeof locale)"
  />
  <UDropdownMenu v-else :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-languages"
      :label="current.short"
      color="neutral"
      variant="ghost"
      :aria-label="t('language.title')"
    />
  </UDropdownMenu>
</template>
