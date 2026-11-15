<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t("settings.title") });
const auth = useAuthStore();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('settings.title')"
      :description="t('settings.description')"
    />

    <AppSection :title="t('settings.account.title')">
      <AppSettingRow :title="t('settings.account.signInMethod')">
        <UBadge
          :color="auth.method === 'dev' ? 'warning' : 'neutral'"
          variant="subtle"
        >
          {{ auth.method === "dev" ? t("auth.devAccount") : t("auth.account") }}
        </UBadge>
      </AppSettingRow>
      <USeparator />
      <AppSettingRow :title="t('settings.account.accountId')">
        <AppCopyValue v-if="auth.account" :value="auth.account.accountId" />
      </AppSettingRow>
      <USeparator />
      <AppSettingRow :title="t('settings.account.productId')">
        <AppCopyValue v-if="auth.account" :value="auth.account.productId" />
      </AppSettingRow>
    </AppSection>

    <AppSection :title="t('settings.appearance.title')">
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
        <AppLanguageSwitcher />
      </AppSettingRow>
    </AppSection>

    <AppSection>
      <AppSettingRow
        :title="t('auth.signOut')"
        :description="t('settings.account.signOutDescription')"
      >
        <UButton
          color="error"
          variant="outline"
          icon="i-lucide-log-out"
          :label="t('auth.signOut')"
          @click="auth.signOut()"
        />
      </AppSettingRow>
    </AppSection>
  </div>
</template>
