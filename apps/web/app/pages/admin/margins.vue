<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.margins") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.margins')"
      :info="t('admin.margins.info')"
    />

    <AdminActionForm :allowed-actions="['markup']" default-action="markup" />

    <AdminDataTable section="margin" />

    <AdminDataTable section="markups" />
  </div>
</template>
