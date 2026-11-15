<script setup lang="ts">
/** Localized error from any thrown value, with an optional retry. */
const props = defineProps<{ error: unknown; retrying?: boolean }>();
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const message = computed(() => t(errorMessageKey(props.error)));
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    :title="t('errors.title')"
    :description="message"
    :actions="[
      {
        label: t('common.retry'),
        color: 'error',
        variant: 'outline',
        loading: retrying,
        onClick: () => emit('retry'),
      },
    ]"
  />
</template>
