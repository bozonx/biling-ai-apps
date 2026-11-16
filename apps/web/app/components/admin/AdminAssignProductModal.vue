<script setup lang="ts">
const props = defineProps<{
  routeId: string;
}>();

const emit = defineEmits<{
  (e: "success"): void;
}>();

const isOpen = defineModel<boolean>("open", { default: false });
const { t } = useI18n();
const admin = useAdminStore();

const isSubmitting = ref(false);
const formError = ref("");

const productId = ref("");
const isActive = ref(true);

const availableProducts = computed(() => {
  const allProds = (admin.catalog.products ?? []) as Array<{
    id: string;
    name: string;
    code: string;
  }>;
  const currentAssigned = (
    (admin.catalog.productRoutes ?? []) as Array<{
      productId: string;
      routeId: string;
    }>
  ).filter((pr) => pr.routeId === props.routeId);

  const assignedIds = new Set(currentAssigned.map((pr) => pr.productId));
  return allProds.filter((p) => !assignedIds.has(p.id));
});

const productOptions = computed(() => {
  return availableProducts.value.map((p) => ({
    label: `${p.name} (${p.code})`,
    value: p.id,
  }));
});

watch(
  () => isOpen.value,
  (open) => {
    if (open) {
      formError.value = "";
      isActive.value = true;
      productId.value = productOptions.value[0]?.value || "";
    }
  },
  { immediate: true },
);

async function onSubmit() {
  if (!productId.value) {
    formError.value = t("admin.routes.errors.selectProduct");
    return;
  }

  formError.value = "";
  isSubmitting.value = true;

  try {
    const success = await admin.executeAction(
      "productRoute",
      ["productId", "routeId"],
      {
        productId: productId.value,
        routeId: props.routeId,
      },
    );

    if (!success) {
      formError.value = admin.error ? t(admin.error) : t("admin.failed");
      isSubmitting.value = false;
      return;
    }

    isOpen.value = false;
    emit("success");
  } catch (err: unknown) {
    formError.value = err instanceof Error ? err.message : t("admin.failed");
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('admin.routes.assignProductTitle')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <form class="space-y-4" @submit.prevent="onSubmit">
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        :title="formError"
        icon="i-lucide-alert-circle"
      />

      <div
        v-if="productOptions.length === 0"
        class="py-4 text-center text-sm text-muted"
      >
        {{ t("admin.routes.allProductsAssigned") }}
      </div>

      <div v-else class="space-y-4">
        <UFormField :label="t('admin.fields.productId')">
          <USelect
            v-model="productId"
            :items="productOptions"
            class="w-full"
            :placeholder="t('admin.selectPlaceholder')"
          />
        </UFormField>

        <div
          class="flex items-center justify-between rounded-lg border border-default p-3"
        >
          <div>
            <div class="text-xs font-semibold">
              {{ t("admin.fields.isActive") }}
            </div>
            <div class="text-xs text-muted">
              {{ t("admin.routes.enableForProductDesc") }}
            </div>
          </div>
          <USwitch v-model="isActive" />
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-2 pt-2 border-t border-default"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          @click="isOpen = false"
        >
          {{ t("common.cancel") }}
        </UButton>
        <UButton
          v-if="productOptions.length > 0"
          type="submit"
          color="primary"
          size="sm"
          :loading="isSubmitting"
        >
          {{ t("common.confirm") }}
        </UButton>
      </div>
    </form>
  </AppModal>
</template>
