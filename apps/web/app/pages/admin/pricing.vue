<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.pricing") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.pricing')"
      :info="t('admin.pricing.info')"
    />

    <AdminActionForm
      :allowed-actions="['feature', 'price', 'rate', 'credits']"
      default-action="feature"
    />

    <AdminDataTable section="features" />

    <AdminDataTable section="prices" />

    <AdminDataTable section="rates" />
  </div>
</template>
