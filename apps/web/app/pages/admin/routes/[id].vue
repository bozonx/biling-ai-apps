<script setup lang="ts">
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
  const list = admin.catalog.routePrices as
    Array<Record<string, any>> | undefined;
  return list?.filter((rp) => rp.routeId === modelRoute.value?.id) ?? [];
});

const assignedProductRoutes = computed(() => {
  if (!modelRoute.value?.id) return [];
  const list = admin.catalog.productRoutes as
    Array<Record<string, any>> | undefined;
  return list?.filter((pr) => pr.routeId === modelRoute.value?.id) ?? [];
});

const isEditModalOpen = ref(false);
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

      <!-- Cost Rates History Table -->
      <AdminDataTable
        section="routePrices"
        :rows="routePriceVersions"
        :title="t('admin.routeDetail.prices')"
        :default-values="{ routeId: modelRoute.id }"
      />

      <!-- Assigned Products Table -->
      <AdminDataTable
        section="productRoutes"
        :rows="assignedProductRoutes"
        :title="t('admin.routeDetail.products')"
        :default-values="{ routeId: modelRoute.id }"
      />

      <!-- Edit Route Modal -->
      <AdminEntityModal
        v-model:open="isEditModalOpen"
        action="route"
        mode="edit"
        :initial-data="modelRoute"
      />
    </div>
  </div>
</template>
