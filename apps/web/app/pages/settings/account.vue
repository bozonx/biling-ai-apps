<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t("settings.account.title") });
const auth = useAuthStore();
</script>

<template>
  <SettingsShell
    :title="t('settings.account.title')"
    :description="t('settings.account.description')"
  >
    <AppSection :title="t('settings.account.details')">
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
  </SettingsShell>
</template>
