<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.plans") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.plans')"
      :info="t('admin.plans.info')"
    />

    <AdminDataTable section="plans" />

    <AdminDataTable section="versions" />
  </div>
</template>
