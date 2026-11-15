<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const admin = useAdminStore();
const config = useRuntimeConfig();

useHead({ title: () => t("admin.settings.title") });

const maskedToken = computed(() => {
  if (!admin.token) return "";
  if (admin.token === "dev-admin") return "dev-admin";
  if (admin.token.length <= 8) return "••••••••";
  return `${admin.token.slice(0, 4)}••••${admin.token.slice(-4)}`;
});

const reloadSuccess = ref(false);

async function onReload() {
  reloadSuccess.value = false;
  const ok = await admin.load();
  if (ok) {
    reloadSuccess.value = true;
    setTimeout(() => {
      reloadSuccess.value = false;
    }, 3000);
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.settings.title')"
      :info="t('admin.settings.info')"
    />

    <!-- Appearance -->
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

    <!-- Session details -->
    <AppSection
      :title="t('admin.settings.session')"
      :info="t('admin.settings.sessionDescription')"
    >
      <AppSettingRow :title="t('admin.settings.tokenActive')">
        <div class="flex items-center gap-2">
          <UBadge
            :color="admin.token === 'dev-admin' ? 'warning' : 'neutral'"
            variant="subtle"
          >
            {{ maskedToken }}
          </UBadge>
        </div>
      </AppSettingRow>

      <USeparator />

      <AppSettingRow :title="t('admin.settings.devMode')">
        <UBadge
          :color="config.public.devLoginEnabled ? 'success' : 'neutral'"
          variant="subtle"
        >
          {{ config.public.devLoginEnabled ? "Enabled" : "Disabled" }}
        </UBadge>
      </AppSettingRow>

      <USeparator />

      <AppSettingRow :title="t('admin.settings.endpoint')">
        <span class="font-mono text-xs text-muted">/api/v1/admin</span>
      </AppSettingRow>
    </AppSection>

    <!-- Cache and Data Actions -->
    <AppSection
      :title="t('admin.settings.cache')"
      :info="t('admin.settings.cacheDescription')"
    >
      <AppSettingRow
        :title="t('admin.settings.reloadCatalog')"
        :description="reloadSuccess ? t('admin.settings.reloaded') : undefined"
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="admin.busy"
          @click="onReload"
        >
          {{ t("common.refresh") }}
        </UButton>
      </AppSettingRow>

      <USeparator />

      <AppSettingRow
        :title="t('admin.settings.signOut')"
        :description="t('admin.settings.signOutDescription')"
      >
        <UButton
          color="error"
          variant="outline"
          icon="i-lucide-log-out"
          @click="admin.disconnect"
        >
          {{ t("admin.disconnect") }}
        </UButton>
      </AppSettingRow>
    </AppSection>
  </div>
</template>
