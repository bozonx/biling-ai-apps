<script setup lang="ts">
definePageMeta({ layout: "admin" });

const { t } = useI18n();
const route = useRoute();
const admin = useAdminStore();

const planId = computed(() => String(route.params.id || ""));

const plan = computed(() => {
  const list = admin.catalog.plans as Array<Record<string, any>> | undefined;
  return (
    list?.find((p) => p.id === planId.value || p.code === planId.value) ?? null
  );
});

useHead({
  title: () =>
    plan.value
      ? `${plan.value.name} (${plan.value.code})`
      : t("admin.planDetail.notFound"),
});

const planVersions = computed(() => {
  if (!plan.value?.id) return [];
  const list = admin.catalog.versions as Array<Record<string, any>> | undefined;
  return list?.filter((v) => v.planId === plan.value?.id) ?? [];
});

function findProductByCode(code: string): Record<string, any> | null {
  const list = admin.catalog.products as Array<Record<string, any>> | undefined;
  return list?.find((p) => p.code === code) ?? null;
}

const isEditModalOpen = ref(false);
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-sm">
      <UButton
        to="/admin/plans"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
      >
        {{ t("admin.planDetail.backToPlans") }}
      </UButton>
      <span class="text-muted">/</span>
      <span class="font-semibold">{{ plan?.name ?? planId }}</span>
    </div>

    <!-- Plan not found -->
    <div v-if="!plan" class="py-12">
      <AppEmptyState
        :title="t('admin.planDetail.notFound')"
        :description="t('admin.planDetail.notFoundDesc')"
        icon="i-lucide-layers"
      >
        <template #actions>
          <UButton to="/admin/plans" color="primary" icon="i-lucide-arrow-left">
            {{ t("admin.planDetail.backToPlans") }}
          </UButton>
        </template>
      </AppEmptyState>
    </div>

    <!-- Plan Content -->
    <div v-else class="space-y-6">
      <UCard>
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <UIcon name="i-lucide-layers" class="size-6" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold tracking-tight">
                  {{ plan.name }}
                </h1>
                <UBadge color="neutral" variant="outline" size="sm">
                  {{ plan.code }}
                </UBadge>
                <UBadge color="primary" variant="subtle" size="sm">
                  {{ plan.kind }}
                </UBadge>
              </div>
              <div class="flex items-center gap-3 text-xs text-muted pt-1">
                <div class="flex items-center gap-1 font-mono">
                  <span>ID:</span>
                  <AppCopyValue :value="plan.id" />
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

        <USeparator class="my-4" />

        <!-- Covered Products (productScope) -->
        <div class="space-y-2">
          <span class="text-xs font-medium text-muted uppercase tracking-wider">
            {{ t("admin.planDetail.productScope") }}:
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <template
              v-if="
                Array.isArray(plan.productScope) && plan.productScope.length > 0
              "
            >
              <template v-for="scopeCode in plan.productScope" :key="scopeCode">
                <NuxtLink
                  v-if="findProductByCode(scopeCode)"
                  :to="`/admin/products/${findProductByCode(scopeCode)!.id}`"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/40 hover:bg-muted text-xs font-medium transition-colors"
                >
                  <UIcon name="i-lucide-package" class="size-3 text-primary" />
                  <span>{{ findProductByCode(scopeCode)!.name }}</span>
                  <span class="text-muted">({{ scopeCode }})</span>
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="size-2.5 text-muted ml-0.5"
                  />
                </NuxtLink>
                <UBadge v-else color="neutral" variant="subtle" size="sm">
                  {{ scopeCode }}
                </UBadge>
              </template>
            </template>
            <span v-else class="text-xs text-muted">
              {{ t("common.noData") }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Plan Versions Table -->
      <AdminDataTable
        section="versions"
        :rows="planVersions"
        :title="t('admin.planDetail.versions')"
        :default-values="{ planId: plan.id }"
      />

      <!-- Edit Plan Modal -->
      <AdminEntityModal
        v-model:open="isEditModalOpen"
        action="plan"
        mode="edit"
        :initial-data="plan"
      />
    </div>
  </div>
</template>
