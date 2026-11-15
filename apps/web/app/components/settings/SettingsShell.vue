<script setup lang="ts">
/** Frame shared by every settings page: header, section nav, content. */
defineProps<{ title: string; description?: string }>();
const { t } = useI18n();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('settings.title')"
      :description="t('settings.description')"
    />
    <div class="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
      <SettingsNav />
      <div class="min-w-0 max-w-3xl space-y-6">
        <div>
          <h2 class="text-base font-semibold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="text-sm text-muted">{{ description }}</p>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
