<script setup lang="ts">
/** `menu`: icon dropdown for the header; `buttons`: segmented control for settings. */
withDefaults(defineProps<{ variant?: "menu" | "buttons" }>(), {
  variant: "menu",
});
const { t } = useI18n();
const { options, preference, current } = useThemeOptions();
const items = computed(() =>
  options.value.map((option) => ({
    label: option.label,
    icon: option.icon,
    type: "checkbox" as const,
    checked: preference.value === option.value,
    onSelect: () => (preference.value = option.value),
  })),
);
</script>

<template>
  <ClientOnly>
    <div
      v-if="variant === 'buttons'"
      class="flex flex-wrap gap-2"
      role="group"
      :aria-label="t('theme.title')"
    >
      <UButton
        v-for="option in options"
        :key="option.value"
        :icon="option.icon"
        :label="option.label"
        :aria-pressed="preference === option.value"
        :color="preference === option.value ? 'primary' : 'neutral'"
        :variant="preference === option.value ? 'solid' : 'outline'"
        @click="preference = option.value"
      />
    </div>
    <UDropdownMenu v-else :items="items" :content="{ align: 'end' }">
      <UButton
        :icon="current.icon"
        color="neutral"
        variant="ghost"
        :aria-label="t('theme.title')"
      />
    </UDropdownMenu>
    <template #fallback>
      <USkeleton :class="variant === 'buttons' ? 'h-8 w-72' : 'size-8'" />
    </template>
  </ClientOnly>
</template>
