<script setup lang="ts">
/** A titled card block used to group content on a page. */
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template v-if="title || $slots.actions" #header>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-sm/6 font-semibold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="text-xs/5 text-muted">
            {{ description }}
          </p>
        </div>
        <slot name="actions" />
      </div>
    </template>
    <slot />
  </UCard>
</template>
