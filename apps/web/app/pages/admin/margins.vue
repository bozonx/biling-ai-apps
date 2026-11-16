<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const admin = useAdminStore();
useHead({ title: () => t("admin.nav.margins") });

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

const filteredMargins = computed(() => {
  const list = admin.catalog.margin as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((m) => m.productId === selectedProductId.value) ?? [];
});

const filteredMarkups = computed(() => {
  const list = admin.catalog.markups as Array<Record<string, any>> | undefined;
  if (!selectedProductId.value) return list ?? [];
  return list?.filter((m) => m.productId === selectedProductId.value) ?? [];
});
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <AppPageHeader
        :title="t('admin.nav.margins')"
        :info="t('admin.margins.info')"
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

    <AdminActionForm :allowed-actions="['markup']" default-action="markup" />

    <AdminDataTable
      section="margin"
      :rows="filteredMargins"
      :can-create="false"
      :can-edit="false"
      :can-delete="false"
    />

    <AdminDataTable
      section="markups"
      :rows="filteredMarkups"
      :default-values="
        selectedProductId ? { productId: selectedProductId } : undefined
      "
    />
  </div>
</template>
