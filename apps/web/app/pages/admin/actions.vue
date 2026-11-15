<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.actions") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.actions')"
      :info="t('admin.actions.info')"
    />

    <AdminActionForm />
  </div>
</template>
