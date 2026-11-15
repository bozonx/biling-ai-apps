<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t("settings.appearance.title") });
</script>

<template>
  <SettingsShell
    :title="t('settings.appearance.title')"
    :description="t('settings.appearance.description')"
  >
    <AppSection>
      <AppSettingRow
        :title="t('theme.title')"
        :description="t('theme.description')"
      >
        <AppThemeSwitcher variant="buttons" />
      </AppSettingRow>
      <USeparator />
      <AppSettingRow
        :title="t('language.title')"
        :description="t('language.description')"
      >
        <AppLanguageSwitcher variant="select" />
      </AppSettingRow>
    </AppSection>
  </SettingsShell>
</template>
