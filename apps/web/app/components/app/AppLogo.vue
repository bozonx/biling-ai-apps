<script setup lang="ts">
defineProps<{ compact?: boolean }>();
const config = useRuntimeConfig();
</script>

<template>
  <NuxtLink
    to="/"
    :aria-label="config.public.appName"
    class="flex min-w-0 items-center gap-2 font-semibold text-highlighted"
  >
    <span
      class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-inverted"
    >
      <UIcon name="i-lucide-wallet" class="size-4" />
    </span>
    <span v-if="!compact" class="truncate text-sm">{{
      config.public.appName
    }}</span>
  </NuxtLink>
</template>
