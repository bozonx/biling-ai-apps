<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const admin = useAdminStore();

const productId = computed(() => String(route.params.id || ""));

const product = computed(() => {
  const list = admin.catalog.products as Array<Record<string, any>> | undefined;
  return (
    list?.find((p) => p.id === productId.value || p.code === productId.value) ??
    null
  );
});

useHead({
  title: () =>
    product.value
      ? `${product.value.name} (${product.value.code})`
      : t("admin.productDetail.notFound"),
});

// Switcher between products
const productSelectOptions = computed(() => {
  const list = admin.catalog.products as Array<Record<string, any>> | undefined;
  return (list ?? []).map((p) => ({
    label: `${p.name} (${p.code})`,
    value: p.id,
  }));
});

function onSelectProduct(newId: unknown) {
  if (newId && typeof newId === "string" && newId !== product.value?.id) {
    void router.push(`/admin/products/${newId}`);
  }
}

// Scoped records
const productFeatures = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.features as Array<Record<string, any>> | undefined;
  return list?.filter((f) => f.productId === product.value?.id) ?? [];
});

const productFeatureIds = computed(() => {
  return new Set(productFeatures.value.map((f) => f.id));
});

const productPrices = computed(() => {
  if (productFeatureIds.value.size === 0) return [];
  const list = admin.catalog.prices as Array<Record<string, any>> | undefined;
  return list?.filter((p) => productFeatureIds.value.has(p.featureId)) ?? [];
});

const productRates = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.rates as Array<Record<string, any>> | undefined;
  return list?.filter((r) => r.productId === product.value?.id) ?? [];
});

const productPlans = computed(() => {
  if (!product.value?.code) return [];
  const list = admin.catalog.plans as Array<Record<string, any>> | undefined;
  return (
    list?.filter(
      (p) =>
        Array.isArray(p.productScope) &&
        p.productScope.includes(product.value?.code),
    ) ?? []
  );
});

const productPlanIds = computed(() => {
  return new Set(productPlans.value.map((p) => p.id));
});

const productVersions = computed(() => {
  if (productPlanIds.value.size === 0) return [];
  const list = admin.catalog.versions as Array<Record<string, any>> | undefined;
  return list?.filter((v) => productPlanIds.value.has(v.planId)) ?? [];
});

const productRoutes = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.productRoutes as
    Array<Record<string, any>> | undefined;
  return list?.filter((pr) => pr.productId === product.value?.id) ?? [];
});

const productMarkups = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.markups as Array<Record<string, any>> | undefined;
  return list?.filter((m) => m.productId === product.value?.id) ?? [];
});

const productMargins = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.margin as Array<Record<string, any>> | undefined;
  return list?.filter((mg) => mg.productId === product.value?.id) ?? [];
});

const productKeys = computed(() => {
  if (!product.value?.id) return [];
  const list = admin.catalog.keys as Array<Record<string, any>> | undefined;
  return list?.filter((k) => k.productId === product.value?.id) ?? [];
});

// Tabs
type TabKey = "overview" | "features" | "plans" | "ai" | "keys";
const activeTab = ref<TabKey>("overview");

const tabs = computed(() => [
  {
    id: "overview" as TabKey,
    label: t("admin.productDetail.tabs.overview"),
    icon: "i-lucide-layout-dashboard",
  },
  {
    id: "features" as TabKey,
    label: t("admin.productDetail.tabs.features"),
    icon: "i-lucide-tag",
    count: productFeatures.value.length,
  },
  {
    id: "plans" as TabKey,
    label: t("admin.productDetail.tabs.plans"),
    icon: "i-lucide-layers",
    count: productPlans.value.length,
  },
  {
    id: "ai" as TabKey,
    label: t("admin.productDetail.tabs.ai"),
    icon: "i-lucide-cpu",
    count: productRoutes.value.length,
  },
  {
    id: "keys" as TabKey,
    label: t("admin.productDetail.tabs.keys"),
    icon: "i-lucide-key",
    count: productKeys.value.length,
  },
]);

// Edit product modal state
const isEditModalOpen = ref(false);
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumbs / Top navigation bar -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div class="flex items-center gap-2 text-sm">
        <UButton
          to="/admin/products"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
        >
          {{ t("admin.productDetail.backToProducts") }}
        </UButton>
        <span class="text-muted">/</span>
        <span class="font-semibold">{{ product?.name ?? productId }}</span>
      </div>

      <div
        v-if="productSelectOptions.length > 1"
        class="flex items-center gap-2"
      >
        <span class="text-xs text-muted">
          {{ t("admin.productDetail.switchProduct") }}:
        </span>
        <USelect
          :model-value="product?.id ?? productId"
          :items="productSelectOptions"
          class="w-48 sm:w-56"
          size="xs"
          @update:model-value="onSelectProduct"
        />
      </div>
    </div>

    <!-- Product not found state -->
    <div v-if="!product" class="py-12">
      <AppEmptyState
        :title="t('admin.productDetail.notFound')"
        :description="t('admin.productDetail.notFoundDesc')"
        icon="i-lucide-package-x"
      >
        <template #actions>
          <UButton
            to="/admin/products"
            color="primary"
            icon="i-lucide-arrow-left"
          >
            {{ t("admin.productDetail.backToProducts") }}
          </UButton>
        </template>
      </AppEmptyState>
    </div>

    <!-- Product Loaded Content -->
    <div v-else class="space-y-6">
      <!-- Product Header Card -->
      <UCard>
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <UIcon name="i-lucide-package" class="size-6" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-bold tracking-tight">
                    {{ product.name }}
                  </h1>
                  <UBadge
                    :color="product.status === 'active' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ product.status }}
                  </UBadge>
                  <UBadge color="neutral" variant="outline" size="sm">
                    {{ product.code }}
                  </UBadge>
                </div>
                <div class="flex items-center gap-3 text-xs text-muted pt-1">
                  <div class="flex items-center gap-1 font-mono">
                    <span>ID:</span>
                    <AppCopyValue :value="product.id" />
                  </div>
                  <span v-if="product.createdAt">·</span>
                  <div v-if="product.createdAt" class="flex items-center gap-1">
                    <span>{{ t("admin.fields.createdAt") }}:</span>
                    <AppDateTime :value="String(product.createdAt)" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              @click="isEditModalOpen = true"
            >
              {{ t("common.edit") }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <UCard>
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wider">
              {{ t("admin.productDetail.stats.features") }}
            </p>
            <p class="text-2xl font-bold tracking-tight">
              {{ productFeatures.length }}
            </p>
          </div>
        </UCard>

        <UCard>
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wider">
              {{ t("admin.productDetail.stats.plans") }}
            </p>
            <p class="text-2xl font-bold tracking-tight">
              {{ productPlans.length }}
            </p>
          </div>
        </UCard>

        <UCard>
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wider">
              {{ t("admin.productDetail.stats.routes") }}
            </p>
            <p class="text-2xl font-bold tracking-tight">
              {{ productRoutes.length }}
            </p>
          </div>
        </UCard>

        <UCard>
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wider">
              {{ t("admin.productDetail.stats.keys") }}
            </p>
            <p class="text-2xl font-bold tracking-tight">
              {{ productKeys.length }}
            </p>
          </div>
        </UCard>
      </div>

      <!-- Navigation Tabs -->
      <div
        class="flex flex-wrap items-center gap-2 border-b border-default pb-2"
      >
        <UButton
          v-for="tab in tabs"
          :key="tab.id"
          :variant="activeTab === tab.id ? 'solid' : 'ghost'"
          :color="activeTab === tab.id ? 'primary' : 'neutral'"
          size="sm"
          :icon="tab.icon"
          @click="activeTab = tab.id"
        >
          <span>{{ tab.label }}</span>
          <UBadge
            v-if="tab.count !== undefined"
            color="neutral"
            variant="subtle"
            size="xs"
            class="ml-1"
          >
            {{ tab.count }}
          </UBadge>
        </UButton>
      </div>

      <!-- Tab Content: Overview -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <AppSection :title="t('admin.productDetail.settings')">
          <AppSettingRow
            :title="t('admin.productDetail.lateCommitWindow')"
            :description="t('admin.productDetail.lateCommitWindowHint')"
          >
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ product.lateCommitWindowSec ?? 604800 }} s
            </UBadge>
          </AppSettingRow>
          <USeparator />
          <AppSettingRow
            :title="t('admin.productDetail.customSettings')"
            align="start"
          >
            <div class="max-w-xl w-full">
              <pre
                class="rounded-lg bg-muted/40 p-3 text-xs font-mono overflow-x-auto text-default"
                >{{
                  product.settings && Object.keys(product.settings).length > 0
                    ? JSON.stringify(product.settings, null, 2)
                    : t("admin.productDetail.noCustomSettings")
                }}</pre>
            </div>
          </AppSettingRow>
        </AppSection>

        <!-- Preview Tables in Overview -->
        <div class="space-y-6">
          <AdminDataTable
            section="features"
            :rows="productFeatures"
            :default-values="{ productId: product.id }"
          />

          <AdminDataTable
            section="plans"
            :rows="productPlans"
            :default-values="{ productScope: [product.code] }"
          />
        </div>
      </div>

      <!-- Tab Content: Features & Pricing -->
      <div v-else-if="activeTab === 'features'" class="space-y-6">
        <AdminDataTable
          section="features"
          :rows="productFeatures"
          :default-values="{ productId: product.id }"
        />

        <AdminDataTable section="prices" :rows="productPrices" />

        <AdminDataTable
          section="rates"
          :rows="productRates"
          :default-values="{ productId: product.id }"
        />
      </div>

      <!-- Tab Content: Plans -->
      <div v-else-if="activeTab === 'plans'" class="space-y-6">
        <AdminDataTable
          section="plans"
          :rows="productPlans"
          :default-values="{ productScope: [product.code] }"
        />

        <AdminDataTable section="versions" :rows="productVersions" />
      </div>

      <!-- Tab Content: AI Models & Margins -->
      <div v-else-if="activeTab === 'ai'" class="space-y-6">
        <AdminDataTable
          section="productRoutes"
          :rows="productRoutes"
          :default-values="{ productId: product.id }"
        />

        <AdminDataTable
          section="markups"
          :rows="productMarkups"
          :default-values="{ productId: product.id }"
        />

        <AdminDataTable
          section="margin"
          :rows="productMargins"
          :can-create="false"
          :can-edit="false"
          :can-delete="false"
        />
      </div>

      <!-- Tab Content: API Keys -->
      <div v-else-if="activeTab === 'keys'" class="space-y-6">
        <AdminDataTable
          section="keys"
          :rows="productKeys"
          :default-values="{ productId: product.id }"
        />
      </div>

      <!-- Modal for editing this product -->
      <AdminEntityModal
        v-model:open="isEditModalOpen"
        action="product"
        mode="edit"
        :initial-data="product"
      />
    </div>
  </div>
</template>
