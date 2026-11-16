<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const admin = useAdminStore();
useHead({ title: () => t("admin.sections.keys") });

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

const filteredKeys = computed(() => {
  const list = admin.catalog.keys as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((k) => k.productId === selectedProductId.value) ?? [];
});
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <AppPageHeader
        :title="t('admin.sections.keys')"
        :info="t('admin.keys.info')"
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
      section="keys"
      :rows="filteredKeys"
      :default-values="
        selectedProductId ? { productId: selectedProductId } : undefined
      "
    />
  </div>
</template>
