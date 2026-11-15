<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  info?: string;
}>();
</script>

<template>
  <header class="flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="text-lg/7 font-semibold text-highlighted sm:text-xl/7">
          <slot name="title">{{ title }}</slot>
        </h1>
        <slot name="info">
          <CommonInfoTooltip v-if="info" :text="info" wide />
        </slot>
      </div>
      <p
        v-if="description || $slots.description"
        class="mt-1 text-sm/6 text-muted"
      >
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
