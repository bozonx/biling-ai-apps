<script setup lang="ts">
withDefaults(
  defineProps<{ icon?: string; title?: string; description?: string }>(),
  {
    icon: "i-lucide-inbox",
    title: undefined,
    description: undefined,
  },
);
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <div
      class="flex size-12 items-center justify-center rounded-full bg-elevated"
    >
      <UIcon :name="icon" class="size-6 text-muted" />
    </div>
    <p class="mt-4 text-sm font-medium text-highlighted">
      {{ title ?? $t("common.noData") }}
    </p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
