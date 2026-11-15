<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const admin = useAdminStore();

useHead({ title: () => t("admin.overview.title") });

const productsCount = computed(() => admin.catalog.products?.length ?? 0);
const plansCount = computed(() => admin.catalog.plans?.length ?? 0);
const routesCount = computed(() => admin.catalog.routes?.length ?? 0);
const keysCount = computed(() => admin.catalog.keys?.length ?? 0);
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.overview.title')"
      :info="t('admin.overview.info')"
    />

    <!-- Quick Stat Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.overview.stats.products") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">
            {{ productsCount }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.overview.stats.plans") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">
            {{ plansCount }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.overview.stats.routes") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">
            {{ routesCount }}
          </p>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.overview.stats.keys") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">
            {{ keysCount }}
          </p>
        </div>
      </UCard>
    </div>

    <!-- Quick Action Execution -->
    <AdminActionForm />

    <!-- Products Catalog Table -->
    <AdminDataTable section="products">
      <template #actions>
        <UButton
          to="/admin/products"
          color="neutral"
          variant="ghost"
          size="xs"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ t("common.viewAll") }}
        </UButton>
      </template>
    </AdminDataTable>
  </div>
</template>
