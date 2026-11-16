<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.routes") });
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.routes')"
      :info="t('admin.routes.info')"
    />

    <AdminDataTable section="routes" />

    <AdminDataTable section="routePrices" />

    <AdminDataTable section="productRoutes" />
  </div>
</template>
