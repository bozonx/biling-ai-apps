<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.sections.products") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.sections.products')"
      :info="t('admin.products.info')"
    />

    <AdminDataTable section="products" />
  </div>
</template>
