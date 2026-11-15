<script setup lang="ts">
/** Navigation rail; rendered both in the desktop aside and the mobile drawer. */
defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
</script>

<template>
  <div class="flex h-full flex-col gap-4 p-3">
    <div
      class="flex h-9 items-center px-1"
      :class="compact ? 'justify-center' : ''"
    >
      <AppLogo :compact="compact" />
    </div>
    <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto">
      <AppNavLink
        v-for="item in MAIN_NAVIGATION"
        :key="item.to"
        :item="item"
        :compact="compact"
        @navigate="emit('navigate')"
      />
    </nav>
    <div class="flex flex-col gap-0.5 border-t border-default pt-3">
      <AppNavLink
        v-for="item in FOOTER_NAVIGATION"
        :key="item.to"
        :item="item"
        :compact="compact"
        @navigate="emit('navigate')"
      />
      <AppUserMenu :compact="compact" />
    </div>
  </div>
</template>
