<script setup lang="ts">
const { t } = useI18n();
const layout = useLayoutStore();
const route = useRoute();
watch(() => route.fullPath, layout.closeMobile);
</script>

<template>
  <div class="min-h-dvh bg-default">
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden border-r border-default bg-default transition-[width] lg:block"
      :class="layout.collapsed ? 'w-16' : 'w-60'"
    >
      <AppSidebar :compact="layout.collapsed" />
    </aside>

    <USlideover
      v-model:open="layout.mobileOpen"
      side="left"
      :title="t('nav.menu')"
      :ui="{ content: 'max-w-72', header: 'sr-only', body: 'p-0 sm:p-0' }"
    >
      <template #body>
        <AppSidebar @navigate="layout.closeMobile" />
      </template>
    </USlideover>

    <div
      class="transition-[padding]"
      :class="layout.collapsed ? 'lg:pl-16' : 'lg:pl-60'"
    >
      <header
        class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-default bg-default/90 px-4 backdrop-blur"
      >
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="lg:hidden"
          :aria-label="t('nav.openMenu')"
          @click="layout.mobileOpen = true"
        />
        <UButton
          :icon="
            layout.collapsed
              ? 'i-lucide-panel-left-open'
              : 'i-lucide-panel-left-close'
          "
          color="neutral"
          variant="ghost"
          class="hidden lg:inline-flex"
          :aria-label="t('nav.toggleSidebar')"
          @click="layout.toggleCollapsed"
        />
        <div class="lg:hidden"><AppLogo /></div>
        <div class="ml-auto flex items-center gap-1">
          <AppLanguageSwitcher />
          <AppThemeSwitcher />
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <slot />
      </main>
    </div>
  </div>
</template>
