<script setup lang="ts">
import {
  parseRoutePriceItems,
  getAssignedProductsForRoute,
  type RoutePriceItem,
} from "~/utils/route-helpers";

definePageMeta({ layout: "admin" });

const { t } = useI18n();
const route = useRoute();
const admin = useAdminStore();

const routeId = computed(() => String(route.params.id || ""));

const modelRoute = computed(() => {
  const list = admin.catalog.routes as Array<Record<string, any>> | undefined;
  return list?.find((r) => r.id === routeId.value) ?? null;
});

useHead({
  title: () =>
    modelRoute.value
      ? `${modelRoute.value.provider} / ${modelRoute.value.model}`
      : t("admin.routeDetail.notFound"),
});

const routePriceVersions = computed(() => {
  if (!modelRoute.value?.id) return [];
  const list = (admin.catalog.routePrices ?? []) as Array<Record<string, any>>;
  return list
    .filter((rp) => rp.routeId === modelRoute.value?.id)
    .sort((a, b) => Number(b.version) - Number(a.version));
});

const activePriceVersion = computed(() => {
  const published = routePriceVersions.value.filter((rp) =>
    Boolean(rp.publishedAt),
  );
  return published[0] ?? null;
});

const nextPriceVersion = computed(() => {
  if (!routePriceVersions.value.length) return 1;
  const max = Math.max(
    ...routePriceVersions.value.map((rp) => Number(rp.version) || 1),
  );
  return max + 1;
});

const allProducts = computed(() => {
  return (admin.catalog.products ?? []) as Array<Record<string, any>>;
});

const assignedProducts = computed(() => {
  if (!modelRoute.value?.id) return [];
  const list = (admin.catalog.productRoutes ?? []) as Array<
    Record<string, any>
  >;
  return getAssignedProductsForRoute(
    modelRoute.value.id,
    list,
    allProducts.value,
  );
});

// Modal states
const isEditModalOpen = ref(false);
const isPriceModalOpen = ref(false);
const isAssignProductModalOpen = ref(false);

const isPublishingId = ref<string | null>(null);

async function onPublishPrice(versionId: string, effectiveFrom: string) {
  isPublishingId.value = versionId;
  try {
    await admin.executeAction("publish", ["target", "id", "effectiveFrom"], {
      target: "routePrice",
      id: versionId,
      effectiveFrom: effectiveFrom || new Date().toISOString(),
    });
  } finally {
    isPublishingId.value = null;
  }
}

async function onToggleProductActive(
  productId: string,
  currentActive: boolean,
) {
  if (!modelRoute.value?.id) return;
  await admin.updateEntity(
    "productRoute",
    "",
    ["isActive"],
    { isActive: !currentActive },
    {
      productId,
      routeId: modelRoute.value.id,
    },
  );
}

async function onRemoveProduct(productId: string) {
  if (!modelRoute.value?.id) return;
  await admin.deleteEntity("productRoute", undefined, {
    productId,
    routeId: modelRoute.value.id,
  });
}

async function onDeletePriceVersion(versionId: string) {
  await admin.deleteEntity("routePrice", versionId);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-sm">
      <UButton
        to="/admin/routes"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
      >
        {{ t("admin.routeDetail.backToRoutes") }}
      </UButton>
      <span class="text-muted">/</span>
      <span class="font-semibold">
        {{
          modelRoute ? `${modelRoute.provider} / ${modelRoute.model}` : routeId
        }}
      </span>
    </div>

    <!-- Route not found -->
    <div v-if="!modelRoute" class="py-12">
      <AppEmptyState
        :title="t('admin.routeDetail.notFound')"
        :description="t('admin.routeDetail.notFoundDesc')"
        icon="i-lucide-git-branch"
      >
        <template #actions>
          <UButton
            to="/admin/routes"
            color="primary"
            icon="i-lucide-arrow-left"
          >
            {{ t("admin.routeDetail.backToRoutes") }}
          </UButton>
        </template>
      </AppEmptyState>
    </div>

    <!-- Route Content -->
    <div v-else class="space-y-6">
      <!-- Header Card -->
      <UCard>
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <UIcon name="i-lucide-cpu" class="size-6" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold tracking-tight">
                  {{ modelRoute.provider }} / {{ modelRoute.model }}
                </h1>
                <UBadge color="neutral" variant="outline" size="sm">
                  {{ modelRoute.variant }}
                </UBadge>
                <UBadge color="primary" variant="subtle" size="sm">
                  {{ modelRoute.kind }}
                </UBadge>
              </div>
              <div class="flex items-center gap-3 text-xs text-muted pt-1">
                <div class="flex items-center gap-1 font-mono">
                  <span>ID:</span>
                  <AppCopyValue :value="modelRoute.id" />
                </div>
                <span v-if="modelRoute.createdAt">·</span>
                <div
                  v-if="modelRoute.createdAt"
                  class="flex items-center gap-1"
                >
                  <span>{{ t("admin.fields.createdAt") }}:</span>
                  <AppDateTime :value="String(modelRoute.createdAt)" />
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

      <!-- Section: Cost Rates (Себестоимость модели) -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold text-base">
                {{ t("admin.routeDetail.prices") }}
              </h2>
              <p class="text-xs text-muted">
                {{ t("admin.routes.costRateSectionDesc") }}
              </p>
            </div>
            <UButton
              color="primary"
              size="xs"
              icon="i-lucide-plus"
              @click="isPriceModalOpen = true"
            >
              {{ t("admin.routes.addPriceVersion") }}
            </UButton>
          </div>
        </template>

        <!-- Active Price Summary Card -->
        <div
          v-if="activePriceVersion"
          class="p-4 bg-primary/5 border-b border-default"
        >
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <div class="flex items-center gap-2">
                <UBadge color="success" size="sm">
                  {{ t("admin.routes.activeRate") }} (v{{
                    activePriceVersion.version
                  }})
                </UBadge>
                <span class="text-xs text-muted">
                  {{ t("admin.routes.effectiveFrom") }}:
                  <AppDateTime
                    :value="String(activePriceVersion.effectiveFrom)"
                  />
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-4 pt-2">
                <div
                  v-for="(item, idx) in parseRoutePriceItems(
                    activePriceVersion.items || [],
                  ).details"
                  :key="idx"
                  class="flex items-center gap-1.5"
                >
                  <UIcon name="i-lucide-tag" class="size-3.5 text-primary" />
                  <span class="font-mono text-sm font-semibold">{{
                    item.formatted
                  }}</span>
                  <span class="text-xs text-muted">({{ item.meter }})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Versions Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/40 text-muted font-medium text-xs">
              <tr>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.fields.version") }}
                </th>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.fields.effectiveFrom") }}
                </th>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.routes.rateItems") }}
                </th>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.fields.publishedAt") }}
                </th>
                <th class="px-4 py-3 text-right whitespace-nowrap">
                  {{ t("admin.actionsColumn") }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-if="routePriceVersions.length === 0">
                <td
                  colspan="5"
                  class="px-4 py-8 text-center text-muted text-sm"
                >
                  {{ t("admin.routes.noPricesConfigured") }}
                </td>
              </tr>
              <tr
                v-for="pv in routePriceVersions"
                :key="pv.id"
                class="hover:bg-muted/20 transition-colors"
              >
                <!-- Version -->
                <td
                  class="px-4 py-3 font-mono font-bold text-xs whitespace-nowrap"
                >
                  v{{ pv.version }}
                </td>

                <!-- Effective From -->
                <td class="px-4 py-3 text-xs whitespace-nowrap">
                  <AppDateTime :value="String(pv.effectiveFrom)" />
                </td>

                <!-- Rate Items -->
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5 font-mono text-xs">
                    <span
                      v-for="(item, idx) in parseRoutePriceItems(pv.items || [])
                        .details"
                      :key="idx"
                      class="px-2 py-0.5 rounded border border-default bg-muted/15"
                    >
                      {{ item.formatted }}
                    </span>
                  </div>
                </td>

                <!-- Published At / Status -->
                <td class="px-4 py-3 whitespace-nowrap">
                  <UBadge
                    v-if="pv.publishedAt"
                    color="success"
                    variant="subtle"
                    size="xs"
                  >
                    {{ t("admin.routes.published") }}
                  </UBadge>
                  <UBadge v-else color="warning" variant="subtle" size="xs">
                    {{ t("admin.routes.draft") }}
                  </UBadge>
                </td>

                <!-- Actions -->
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1.5">
                    <UButton
                      v-if="!pv.publishedAt"
                      color="primary"
                      variant="subtle"
                      size="xs"
                      icon="i-lucide-check-circle"
                      :loading="isPublishingId === pv.id"
                      @click="onPublishPrice(pv.id, pv.effectiveFrom)"
                    >
                      {{ t("admin.routes.publishNow") }}
                    </UButton>
                    <UButton
                      v-if="!pv.publishedAt"
                      color="error"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-trash-2"
                      @click="onDeletePriceVersion(pv.id)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Section: Assigned Products (Назначение продуктам) -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold text-base">
                {{ t("admin.routeDetail.products") }}
              </h2>
              <p class="text-xs text-muted">
                {{ t("admin.routes.productsSectionDesc") }}
              </p>
            </div>
            <UButton
              color="primary"
              size="xs"
              icon="i-lucide-plus"
              @click="isAssignProductModalOpen = true"
            >
              {{ t("admin.routes.assignProduct") }}
            </UButton>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/40 text-muted font-medium text-xs">
              <tr>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.fields.productId") }}
                </th>
                <th class="px-4 py-3 whitespace-nowrap">
                  {{ t("admin.fields.isActive") }}
                </th>
                <th class="px-4 py-3 text-right whitespace-nowrap">
                  {{ t("admin.actionsColumn") }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-if="assignedProducts.length === 0">
                <td
                  colspan="3"
                  class="px-4 py-8 text-center text-muted text-sm"
                >
                  {{ t("admin.routes.noProductsAssigned") }}
                </td>
              </tr>
              <tr
                v-for="ap in assignedProducts"
                :key="ap.productId"
                class="hover:bg-muted/20 transition-colors"
              >
                <!-- Product name -->
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="`/admin/products/${ap.productId}`"
                    class="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 font-sans"
                  >
                    <UIcon name="i-lucide-package" class="size-4 text-muted" />
                    <span>{{ ap.name }}</span>
                    <span class="text-xs text-muted font-mono"
                      >({{ ap.code }})</span
                    >
                  </NuxtLink>
                </td>

                <!-- Status toggle -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <USwitch
                      :model-value="ap.isActive"
                      size="sm"
                      @update:model-value="
                        onToggleProductActive(ap.productId, ap.isActive)
                      "
                    />
                    <UBadge
                      :color="ap.isActive ? 'success' : 'neutral'"
                      variant="subtle"
                      size="xs"
                    >
                      {{
                        ap.isActive
                          ? t("admin.enums.status.active")
                          : t("admin.enums.status.disabled")
                      }}
                    </UBadge>
                  </div>
                </td>

                <!-- Actions -->
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-trash-2"
                    :title="t('admin.routes.removeProduct')"
                    @click="onRemoveProduct(ap.productId)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Edit Route Modal -->
      <AdminEntityModal
        v-model:open="isEditModalOpen"
        action="route"
        mode="edit"
        :initial-data="modelRoute"
        @success="admin.load()"
      />

      <!-- Create Price Version Modal -->
      <AdminRoutePriceModal
        v-model:open="isPriceModalOpen"
        :route-id="modelRoute.id"
        :route-kind="modelRoute.kind"
        :next-version="nextPriceVersion"
        @success="admin.load()"
      />

      <!-- Assign Product Modal -->
      <AdminAssignProductModal
        v-model:open="isAssignProductModalOpen"
        :route-id="modelRoute.id"
        @success="admin.load()"
      />
    </div>
  </div>
</template>
