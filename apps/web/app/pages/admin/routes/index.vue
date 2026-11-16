<script setup lang="ts">
import {
  getRoutePriceSummary,
  getAssignedProductsForRoute,
} from "~/utils/route-helpers";

definePageMeta({ layout: "admin" });

const { t } = useI18n();
useHead({ title: () => t("admin.nav.routes") });

const admin = useAdminStore();

const searchQuery = ref("");
const selectedKind = ref("all");
const selectedProvider = ref("all");

const isCreateModalOpen = ref(false);
const isEditModalOpen = ref(false);
const selectedRoute = ref<Record<string, any> | null>(null);

const isDeleteConfirmOpen = ref(false);
const routeToDelete = ref<Record<string, any> | null>(null);

const allRoutes = computed(() => {
  return (admin.catalog.routes ?? []) as Array<Record<string, any>>;
});

const allRoutePrices = computed(() => {
  return (admin.catalog.routePrices ?? []) as Array<Record<string, any>>;
});

const allProductRoutes = computed(() => {
  return (admin.catalog.productRoutes ?? []) as Array<Record<string, any>>;
});

const allProducts = computed(() => {
  return (admin.catalog.products ?? []) as Array<Record<string, any>>;
});

// Stats
const totalRoutes = computed(() => allRoutes.value.length);
const uniqueProviders = computed(() => {
  const set = new Set(allRoutes.value.map((r) => r.provider));
  return set.size;
});
const routesWithPrices = computed(() => {
  const pricedRouteIds = new Set(allRoutePrices.value.map((rp) => rp.routeId));
  return allRoutes.value.filter((r) => pricedRouteIds.has(r.id)).length;
});

// Filter Options
const kindOptions = computed(() => [
  { label: t("admin.routes.allKinds"), value: "all" },
  { label: "LLM (Language)", value: "llm" },
  { label: "STT (Speech)", value: "stt" },
  { label: "TTS (Voice)", value: "tts" },
  { label: "Image", value: "image" },
  { label: "Video", value: "video" },
  { label: "Embeddings", value: "embed" },
]);

const providerOptions = computed(() => {
  const providers = Array.from(
    new Set(allRoutes.value.map((r) => r.provider)),
  ).sort();
  return [
    { label: t("admin.routes.allProviders"), value: "all" },
    ...providers.map((p) => ({ label: p, value: p })),
  ];
});

// Filtered Routes
const filteredRoutes = computed(() => {
  return allRoutes.value.filter((r) => {
    if (selectedKind.value !== "all" && r.kind !== selectedKind.value) {
      return false;
    }
    if (
      selectedProvider.value !== "all" &&
      r.provider !== selectedProvider.value
    ) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchModel = String(r.model || "")
        .toLowerCase()
        .includes(q);
      const matchProvider = String(r.provider || "")
        .toLowerCase()
        .includes(q);
      const matchVariant = String(r.variant || "")
        .toLowerCase()
        .includes(q);
      if (!matchModel && !matchProvider && !matchVariant) return false;
    }
    return true;
  });
});

function openEditModal(route: Record<string, any>) {
  selectedRoute.value = route;
  isEditModalOpen.value = true;
}

function openDeleteConfirm(route: Record<string, any>) {
  routeToDelete.value = route;
  isDeleteConfirmOpen.value = true;
}

async function confirmDelete() {
  if (!routeToDelete.value?.id) return;
  const success = await admin.deleteEntity("route", routeToDelete.value.id);
  if (success) {
    isDeleteConfirmOpen.value = false;
    routeToDelete.value = null;
  }
}

function getProviderIcon(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return "i-lucide-sparkles";
    case "anthropic":
      return "i-lucide-bot";
    case "google":
      return "i-lucide-cpu";
    case "groq":
      return "i-lucide-zap";
    case "deepgram":
      return "i-lucide-mic";
    default:
      return "i-lucide-brain-circuit";
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('admin.nav.routes')"
      :info="t('admin.routes.info')"
    >
      <template #actions>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          size="sm"
          @click="isCreateModalOpen = true"
        >
          {{ t("admin.routes.createRoute") }}
        </UButton>
      </template>
    </AppPageHeader>

    <!-- Stats summary -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.routes.statsTotal") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">{{ totalRoutes }}</p>
        </div>
      </UCard>
      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.routes.statsProviders") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">{{ uniqueProviders }}</p>
        </div>
      </UCard>
      <UCard>
        <div class="space-y-1">
          <p class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.routes.statsPriced") }}
          </p>
          <p class="text-2xl font-bold tracking-tight">
            {{ routesWithPrices }}
          </p>
        </div>
      </UCard>
    </div>

    <!-- Main Card & Filters -->
    <UCard :ui="{ body: 'p-0' }">
      <template #header>
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-base">
              {{ t("admin.sections.routes") }}
            </h2>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ filteredRoutes.length }}
            </UBadge>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              size="xs"
              :placeholder="t('admin.routes.searchPlaceholder')"
              class="w-48 sm:w-60"
            />
            <USelect
              v-model="selectedKind"
              :items="kindOptions"
              size="xs"
              class="w-36"
            />
            <USelect
              v-if="providerOptions.length > 2"
              v-model="selectedProvider"
              :items="providerOptions"
              size="xs"
              class="w-36"
            />
          </div>
        </div>
      </template>

      <!-- Routes Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-muted/40 text-muted font-medium text-xs">
            <tr>
              <th class="px-4 py-3 whitespace-nowrap">
                {{ t("admin.routes.colModel") }}
              </th>
              <th class="px-4 py-3 whitespace-nowrap">
                {{ t("admin.fields.kind") }}
              </th>
              <th class="px-4 py-3 whitespace-nowrap">
                {{ t("admin.fields.variant") }}
              </th>
              <th class="px-4 py-3 whitespace-nowrap">
                {{ t("admin.routes.colCostRate") }}
              </th>
              <th class="px-4 py-3 whitespace-nowrap">
                {{ t("admin.routes.colProducts") }}
              </th>
              <th class="px-4 py-3 text-right whitespace-nowrap">
                {{ t("admin.actionsColumn") }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-if="filteredRoutes.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-muted text-sm">
                {{ t("common.noData") }}
              </td>
            </tr>
            <tr
              v-for="route in filteredRoutes"
              :key="route.id"
              class="hover:bg-muted/20 transition-colors"
            >
              <!-- Model & Provider -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0"
                  >
                    <UIcon
                      :name="getProviderIcon(route.provider)"
                      class="size-4"
                    />
                  </div>
                  <div>
                    <NuxtLink
                      :to="`/admin/routes/${route.id}`"
                      class="font-semibold text-primary hover:underline inline-flex items-center gap-1 font-mono text-xs"
                    >
                      <span>{{ route.provider }}/{{ route.model }}</span>
                      <UIcon
                        name="i-lucide-arrow-right"
                        class="size-3 text-muted shrink-0"
                      />
                    </NuxtLink>
                    <div class="text-[11px] text-muted font-mono">
                      ID: {{ route.id.slice(0, 8) }}...
                    </div>
                  </div>
                </div>
              </td>

              <!-- Kind -->
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge color="primary" variant="subtle" size="xs">
                  {{ route.kind }}
                </UBadge>
              </td>

              <!-- Variant -->
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge color="neutral" variant="outline" size="xs">
                  {{ route.variant }}
                </UBadge>
              </td>

              <!-- Cost Rate -->
              <td class="px-4 py-3">
                <div class="space-y-0.5">
                  <div class="font-mono text-xs font-medium">
                    {{
                      getRoutePriceSummary(route.id, allRoutePrices)
                        .formattedSummary
                    }}
                  </div>
                  <div class="flex items-center gap-1.5">
                    <UBadge
                      v-if="
                        getRoutePriceSummary(route.id, allRoutePrices).version >
                        0
                      "
                      :color="
                        getRoutePriceSummary(route.id, allRoutePrices)
                          .isPublished
                          ? 'success'
                          : 'warning'
                      "
                      variant="subtle"
                      size="xs"
                      class="text-[10px]"
                    >
                      {{
                        getRoutePriceSummary(route.id, allRoutePrices)
                          .isPublished
                          ? `v${getRoutePriceSummary(route.id, allRoutePrices).version}`
                          : `v${getRoutePriceSummary(route.id, allRoutePrices).version} (${t("admin.routes.draft")})`
                      }}
                    </UBadge>
                    <span v-else class="text-[11px] text-muted">
                      {{ t("admin.routes.notConfigured") }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Assigned Products -->
              <td class="px-4 py-3">
                <div
                  v-if="
                    getAssignedProductsForRoute(
                      route.id,
                      allProductRoutes,
                      allProducts,
                    ).length > 0
                  "
                  class="flex flex-wrap gap-1"
                >
                  <UBadge
                    v-for="p in getAssignedProductsForRoute(
                      route.id,
                      allProductRoutes,
                      allProducts,
                    )"
                    :key="p.productId"
                    :color="p.isActive ? 'neutral' : 'warning'"
                    variant="subtle"
                    size="xs"
                    class="font-sans"
                  >
                    {{ p.name }}
                  </UBadge>
                </div>
                <span v-else class="text-xs text-muted">
                  {{ t("admin.routes.noProductsAssigned") }}
                </span>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    :to="`/admin/routes/${route.id}`"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-external-link"
                    :title="t('admin.routes.openDetails')"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-pencil"
                    :title="t('common.edit')"
                    @click="openEditModal(route)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-trash-2"
                    :title="t('common.delete')"
                    @click="openDeleteConfirm(route)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create Route Modal -->
    <AdminEntityModal
      v-model:open="isCreateModalOpen"
      action="route"
      mode="create"
      @success="admin.load()"
    />

    <!-- Edit Route Modal -->
    <AdminEntityModal
      v-if="selectedRoute"
      v-model:open="isEditModalOpen"
      action="route"
      mode="edit"
      :initial-data="selectedRoute"
      @success="admin.load()"
    />

    <!-- Delete Confirm Modal -->
    <AppModal
      v-model:open="isDeleteConfirmOpen"
      :title="t('admin.deleteConfirmTitle')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <div class="space-y-4">
        <p class="text-sm text-muted">
          {{ t("admin.deleteConfirmDesc") }}
        </p>
        <div
          v-if="routeToDelete"
          class="p-3 bg-muted/15 rounded-lg font-mono text-xs"
        >
          {{ routeToDelete.provider }} / {{ routeToDelete.model }} [{{
            routeToDelete.variant
          }}]
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            @click="isDeleteConfirmOpen = false"
          >
            {{ t("common.cancel") }}
          </UButton>
          <UButton color="error" size="sm" @click="confirmDelete">
            {{ t("common.delete") }}
          </UButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
