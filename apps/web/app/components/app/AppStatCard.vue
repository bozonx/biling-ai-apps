<script setup lang="ts">
defineProps<{
  label: string;
  icon?: string;
  loading?: boolean;
  hint?: string;
  color?: "primary" | "neutral" | "warning" | "error" | "success";
}>();
const COLORS = {
  primary: "text-primary",
  neutral: "text-muted",
  warning: "text-warning",
  error: "text-error",
  success: "text-success",
} as const;
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }">
    <div class="flex items-center gap-2 text-xs font-medium text-muted">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-4"
        :class="COLORS[color ?? 'neutral']"
      />
      {{ label }}
    </div>
    <USkeleton v-if="loading" class="mt-3 h-8 w-32" />
    <div
      v-else
      class="mt-2 text-2xl font-semibold tabular-nums text-highlighted"
    >
      <slot />
    </div>
    <p v-if="hint" class="mt-1 text-xs text-dimmed">{{ hint }}</p>
  </UCard>
</template>
