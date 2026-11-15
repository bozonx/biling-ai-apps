<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t("nav.dashboard") });
const wallet = useWalletStore();
onMounted(() => void wallet.refresh());

const columns = computed(() => [
  { key: "kind", label: t("operations.kind") },
  {
    key: "balanceAfterMilli",
    label: t("operations.balanceAfter"),
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
      :title="t('dashboard.title')"
      :description="t('dashboard.description')"
    >
      <template #actions>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :label="t('common.refresh')"
          :loading="wallet.walletLoading || wallet.operationsLoading"
          @click="wallet.refresh()"
        />
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="wallet.walletError"
      :error="wallet.walletError"
      :retrying="wallet.walletLoading"
      @retry="wallet.fetchWallet()"
    />

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AppStatCard
        :label="t('wallet.available')"
        icon="i-lucide-wallet"
        color="primary"
        :loading="!wallet.wallet && wallet.walletLoading"
      >
        <AppCredits :milli="wallet.available" />
      </AppStatCard>
      <AppStatCard
        :label="t('wallet.balance')"
        icon="i-lucide-coins"
        :loading="!wallet.wallet && wallet.walletLoading"
      >
        <AppCredits :milli="wallet.wallet?.balanceMilli" />
      </AppStatCard>
      <AppStatCard
        :label="t('wallet.held')"
        icon="i-lucide-lock"
        color="warning"
        :hint="t('wallet.heldHint')"
        :loading="!wallet.wallet && wallet.walletLoading"
      >
        <AppCredits :milli="wallet.wallet?.heldMilli" />
      </AppStatCard>
      <AppStatCard
        :label="t('wallet.debt')"
        icon="i-lucide-circle-alert"
        color="error"
        :loading="!wallet.wallet && wallet.walletLoading"
      >
        <AppCredits :milli="wallet.wallet?.debtMilli" />
      </AppStatCard>
    </div>

    <AppSection :title="t('dashboard.recentOperations')">
      <template #actions>
        <UButton
          to="/operations"
          size="sm"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
          :label="t('common.viewAll')"
        />
      </template>
      <AppErrorState
        v-if="wallet.operationsError"
        :error="wallet.operationsError"
        :retrying="wallet.operationsLoading"
        @retry="wallet.fetchOperations()"
      />
      <div v-else class="-mx-4 sm:-mx-6">
        <AppDataTable
          :columns="columns"
          :rows="wallet.recentOperations"
          :loading="wallet.operationsLoading"
          :empty-title="t('operations.empty')"
        >
          <template #cell-kind="{ row }">{{
            operationKindLabel(row.kind)
          }}</template>
          <template #cell-balanceAfterMilli="{ row }">
            <AppCredits :milli="row.balanceAfterMilli" />
          </template>
          <template #cell-createdAt="{ row }"
            ><AppDateTime :value="row.createdAt"
          /></template>
        </AppDataTable>
      </div>
    </AppSection>
  </div>
</template>
