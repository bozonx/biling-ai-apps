<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="min-h-dvh bg-default">
    <header
      class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-default bg-default/90 px-4 backdrop-blur sm:px-6"
    >
      <div class="flex items-center gap-3 sm:gap-6">
        <AppLogo />
        <nav class="flex items-center gap-1" :aria-label="t('nav.menu')">
          <AppNavLink
            v-for="item in MAIN_NAVIGATION"
            :key="item.to"
            :item="item"
          />
        </nav>
      </div>

      <div class="flex items-center gap-2">
        <AppUserMenu />
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <slot />
    </main>
  </div>
</template>
