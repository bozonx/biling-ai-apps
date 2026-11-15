<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.sections.tasks") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.sections.tasks')"
      :info="t('admin.tasks.info')"
    />

    <AdminDataTable section="tasks" />
  </div>
</template>
