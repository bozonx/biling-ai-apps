<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.sections.keys") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.sections.keys')"
      :info="t('admin.keys.info')"
    />

    <AdminActionForm
      :allowed-actions="['key', 'revokeKey']"
      default-action="key"
    />

    <AdminDataTable section="keys" />
  </div>
</template>
