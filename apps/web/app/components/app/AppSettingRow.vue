<script setup lang="ts">
/** "Explanation on the left, control on the right" row. */
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
    <div class="min-w-0 flex-1 basis-64">
      <h3 v-if="title" class="text-sm/6 font-medium text-highlighted">
        {{ title }}
      </h3>
      <p v-if="description" class="mt-0.5 text-xs/5 text-muted">
        {{ description }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
