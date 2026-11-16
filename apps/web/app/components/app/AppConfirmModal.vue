<script setup lang="ts">
/**
 * Unified Confirmation Modal Component
 *
 * Adapted from bloggerdog app/components/AppConfirmModal.vue
 * Provides a standardized prompt with confirm and cancel buttons.
 */

type ButtonColor =
  | "primary"
  | "secondary"
  | "neutral"
  | "error"
  | "warning"
  | "success"
  | "info";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    color?: ButtonColor;
    icon?: string;
    loading?: boolean;
    confirmDisabled?: boolean;
  }>(),
  {
    description: undefined,
    confirmText: undefined,
    cancelText: undefined,
    color: "primary",
    icon: undefined,
    loading: false,
    confirmDisabled: false,
  },
);

const emit = defineEmits<{
  (e: "confirm"): void;
}>();

const isOpen = defineModel<boolean>("open", { required: true });

const { t } = useI18n();

const handleConfirm = () => {
  emit("confirm");
};

const handleClose = () => {
  isOpen.value = false;
};
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="props.title"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <div class="flex flex-col gap-4">
      <div v-if="props.icon || props.description" class="flex gap-4">
        <div v-if="props.icon" class="shrink-0">
          <UIcon
            :name="props.icon"
            class="w-6 h-6"
            :class="{
              'text-primary-500': props.color === 'primary',
              'text-error-500': props.color === 'error',
              'text-warning-500': props.color === 'warning',
              'text-success-500': props.color === 'success',
              'text-info-500': props.color === 'info',
              'text-gray-500':
                props.color === 'neutral' || props.color === 'secondary',
            }"
          />
        </div>
        <div v-if="props.description" class="flex-1">
          <p class="text-sm text-muted">
            {{ props.description }}
          </p>
        </div>
      </div>

      <div v-if="$slots.default" class="w-full">
        <slot />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <UButton color="neutral" variant="ghost" @click="handleClose">
          {{ props.cancelText || t("common.cancel") }}
        </UButton>
        <UButton
          :color="props.color"
          :loading="props.loading"
          :disabled="props.confirmDisabled"
          @click="handleConfirm"
        >
          {{ props.confirmText || t("common.confirm") }}
        </UButton>
      </div>
    </template>
  </AppModal>
</template>
