<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const admin = useAdminStore();
useHead({ title: () => t("admin.nav.pricing") });

const selectedProductId = ref<string>("");

const productOptions = computed(() => {
  const list = admin.catalog.products as Array<Record<string, any>> | undefined;
  return [
    { label: t("admin.allProducts"), value: "" },
    ...(list ?? []).map((p) => ({
      label: `${p.name} (${p.code})`,
      value: p.id,
    })),
  ];
});

const filteredFeatures = computed(() => {
  const list = admin.catalog.features as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((f) => f.productId === selectedProductId.value) ?? [];
});

const filteredFeatureIds = computed(() => {
  return new Set(filteredFeatures.value.map((f) => f.id));
});

const filteredPrices = computed(() => {
  const list = admin.catalog.prices as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((p) => filteredFeatureIds.value.has(p.featureId)) ?? [];
});

const filteredRates = computed(() => {
  const list = admin.catalog.rates as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((r) => r.productId === selectedProductId.value) ?? [];
});
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <AppPageHeader
        :title="t('admin.nav.pricing')"
        :info="t('admin.pricing.info')"
      />

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-muted">
          {{ t("admin.filterByProduct") }}:
        </span>
        <USelect
          v-model="selectedProductId"
          :items="productOptions"
          class="w-48 sm:w-56"
          size="xs"
        />
      </div>
    </div>

    <AdminDataTable
      section="features"
      :rows="filteredFeatures"
      :default-values="
        selectedProductId ? { productId: selectedProductId } : undefined
      "
    />

    <AdminDataTable section="prices" :rows="filteredPrices" />

    <AdminDataTable
      section="rates"
      :rows="filteredRates"
      :default-values="
        selectedProductId ? { productId: selectedProductId } : undefined
      "
    />
  </div>
</template>
