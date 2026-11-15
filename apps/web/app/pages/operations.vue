<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t("nav.operations") });
const wallet = useWalletStore();
onMounted(() => void wallet.fetchOperations());

const columns = computed(() => [
  { key: "walletSeq", label: "#", class: "w-16 text-dimmed" },
  { key: "kind", label: t("operations.kind") },
  {
    key: "balanceAfterMilli",
    label: t("operations.balanceAfter"),
    align: "right" as const,
  },
  {
    key: "debtAfterMilli",
    label: t("operations.debtAfter"),
    align: "right" as const,
  },
  {
    key: "createdAt",
    label: t("operations.createdAt"),
    align: "right" as const,
  },
]);
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      :title="t('operations.title')"
      :description="t('operations.description')"
    >
      <template #actions>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :label="t('common.refresh')"
          :loading="wallet.operationsLoading"
          @click="wallet.fetchOperations()"
        />
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="wallet.operationsError"
      :error="wallet.operationsError"
      :retrying="wallet.operationsLoading"
      @retry="wallet.fetchOperations()"
    />
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }">
      <AppDataTable
        :columns="columns"
        :rows="wallet.operations"
        :loading="wallet.operationsLoading"
        :empty-title="t('operations.empty')"
        :empty-description="t('operations.emptyDescription')"
      >
        <template #cell-kind="{ row }">
          <UBadge color="neutral" variant="subtle">{{
            operationKindLabel(row.kind)
          }}</UBadge>
        </template>
        <template #cell-balanceAfterMilli="{ row }">
          <AppCredits :milli="row.balanceAfterMilli" />
        </template>
        <template #cell-debtAfterMilli="{ row }"
          ><AppCredits :milli="row.debtAfterMilli"
        /></template>
        <template #cell-createdAt="{ row }"
          ><AppDateTime :value="row.createdAt"
        /></template>
      </AppDataTable>
    </UCard>
  </div>
</template>
