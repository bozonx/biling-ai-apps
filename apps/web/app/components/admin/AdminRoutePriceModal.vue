<script setup lang="ts">
import { buildRoutePriceItems } from "~/utils/route-helpers";

const props = defineProps<{
  routeId: string;
  routeKind?: string;
  nextVersion?: number;
}>();

const emit = defineEmits<{
  (e: "success"): void;
}>();

const isOpen = defineModel<boolean>("open", { default: false });
const { t } = useI18n();
const admin = useAdminStore();

const isSubmitting = ref(false);
const formError = ref("");

const version = ref(props.nextVersion || 1);
const effectiveFrom = ref(new Date().toISOString());
const publishImmediately = ref(true);

// LLM Fields
const inputCostPer1M = ref<number | undefined>(undefined);
const outputCostPer1M = ref<number | undefined>(undefined);

// Audio Fields
const audioCostPerMin = ref<number | undefined>(undefined);

// Custom Meter Fields
const customMeter = ref("");
const customCostPerUnit = ref<number | undefined>(undefined);

watch(
  () => isOpen.value,
  (open) => {
    if (open) {
      formError.value = "";
      version.value = props.nextVersion || 1;
      effectiveFrom.value = new Date().toISOString();
      publishImmediately.value = true;
      inputCostPer1M.value = undefined;
      outputCostPer1M.value = undefined;
      audioCostPerMin.value = undefined;
      customMeter.value = "";
      customCostPerUnit.value = undefined;

      // Smart defaults based on kind
      if (props.routeKind === "stt" || props.routeKind === "tts") {
        audioCostPerMin.value = 0.006;
      } else if (props.routeKind === "image") {
        customMeter.value = "images";
        customCostPerUnit.value = 0.04;
      } else {
        inputCostPer1M.value = 1.5;
        outputCostPer1M.value = 6.0;
      }
    }
  },
  { immediate: true },
);

async function onSubmit() {
  formError.value = "";
  isSubmitting.value = true;

  try {
    const items = buildRoutePriceItems({
      inputUsdPer1M: inputCostPer1M.value,
      outputUsdPer1M: outputCostPer1M.value,
      audioUsdPerMin: audioCostPerMin.value,
      customMeter: customMeter.value || undefined,
      customUsdPerUnit: customCostPerUnit.value,
    });

    if (!items.length) {
      formError.value = t("admin.routes.errors.atLeastOnePriceRequired");
      isSubmitting.value = false;
      return;
    }

    const payload = {
      routeId: props.routeId,
      version: Number(version.value),
      effectiveFrom: effectiveFrom.value,
      items,
    };

    const success = await admin.executeAction(
      "routePrice",
      ["routeId", "version", "effectiveFrom", "items"],
      payload,
    );

    if (!success) {
      formError.value = admin.error ? t(admin.error) : t("admin.failed");
      isSubmitting.value = false;
      return;
    }

    if (publishImmediately.value) {
      const createdVersion = (
        admin.catalog.routePrices as Array<Record<string, any>> | undefined
      )?.find(
        (rp) =>
          rp.routeId === props.routeId &&
          Number(rp.version) === Number(version.value),
      );

      if (createdVersion?.id) {
        await admin.executeAction(
          "publish",
          ["target", "id", "effectiveFrom"],
          {
            target: "routePrice",
            id: createdVersion.id,
            effectiveFrom: effectiveFrom.value,
          },
        );
      }
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
    :title="t('admin.routes.createPriceVersionTitle')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <form class="space-y-4" @submit.prevent="onSubmit">
      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        :title="formError"
        icon="i-lucide-alert-circle"
      />

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('admin.fields.version')">
          <UInput
            v-model.number="version"
            type="number"
            min="1"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('admin.fields.effectiveFrom')">
          <UInput
            v-model="effectiveFrom"
            type="datetime-local"
            required
            class="w-full text-xs"
          />
        </UFormField>
      </div>

      <!-- LLM token pricing -->
      <div
        v-if="!routeKind || routeKind === 'llm' || routeKind === 'embed'"
        class="space-y-3 rounded-lg border border-default p-3 bg-muted/10"
      >
        <div class="font-medium text-xs text-muted">
          {{ t("admin.routes.llmPricingTitle") }}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UFormField :label="t('admin.routes.inputPer1M')">
            <UInput
              v-model.number="inputCostPer1M"
              type="number"
              step="0.0001"
              min="0"
              placeholder="1.50"
              icon="i-lucide-dollar-sign"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('admin.routes.outputPer1M')">
            <UInput
              v-model.number="outputCostPer1M"
              type="number"
              step="0.0001"
              min="0"
              placeholder="6.00"
              icon="i-lucide-dollar-sign"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>

      <!-- Audio pricing (STT / TTS) -->
      <div
        v-if="routeKind === 'stt' || routeKind === 'tts'"
        class="space-y-3 rounded-lg border border-default p-3 bg-muted/10"
      >
        <div class="font-medium text-xs text-muted">
          {{ t("admin.routes.audioPricingTitle") }}
        </div>
        <UFormField :label="t('admin.routes.audioPerMin')">
          <UInput
            v-model.number="audioCostPerMin"
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.006"
            icon="i-lucide-dollar-sign"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Custom unit pricing -->
      <div
        v-if="routeKind === 'image' || routeKind === 'video'"
        class="space-y-3 rounded-lg border border-default p-3 bg-muted/10"
      >
        <div class="font-medium text-xs text-muted">
          {{ t("admin.routes.mediaPricingTitle") }}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('admin.fields.meter')">
            <UInput
              v-model="customMeter"
              placeholder="images / video_seconds"
              class="w-full font-mono text-xs"
            />
          </UFormField>
          <UFormField :label="t('admin.routes.costPerUnit')">
            <UInput
              v-model.number="customCostPerUnit"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.04"
              icon="i-lucide-dollar-sign"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>

      <!-- Publish immediately toggle -->
      <div
        class="flex items-center justify-between rounded-lg border border-default p-3"
      >
        <div>
          <div class="text-xs font-semibold">
            {{ t("admin.routes.publishImmediately") }}
          </div>
          <div class="text-xs text-muted">
            {{ t("admin.routes.publishImmediatelyDesc") }}
          </div>
        </div>
        <USwitch v-model="publishImmediately" />
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
          type="submit"
          color="primary"
          size="sm"
          :loading="isSubmitting"
        >
          {{ t("common.save") }}
        </UButton>
      </div>
    </form>
  </AppModal>
</template>
