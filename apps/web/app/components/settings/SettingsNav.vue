<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
</script>

<template>
  <nav
    class="flex gap-1 overflow-x-auto md:flex-col"
    :aria-label="t('nav.settings')"
  >
    <UButton
      v-for="item in SETTINGS_NAVIGATION"
      :key="item.to"
      :to="item.to"
      :icon="item.icon"
      :label="t(item.label)"
      color="neutral"
      variant="ghost"
      :active="isNavActive(route.path, item.to)"
      active-variant="soft"
      class="shrink-0 justify-start"
    />
  </nav>
</template>
