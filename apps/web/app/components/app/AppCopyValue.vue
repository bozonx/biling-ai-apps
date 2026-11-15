<script setup lang="ts">
/** A monospace value with a copy-to-clipboard button. */
const props = defineProps<{ value: string }>();
const { t } = useI18n();
const toast = useToast();

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    toast.add({
      title: t("common.copied"),
      color: "success",
      icon: "i-lucide-check",
    });
  } catch {
    toast.add({ title: t("errors.COPY_FAILED"), color: "error" });
  }
}
</script>

<template>
  <span class="inline-flex min-w-0 items-center gap-1">
    <code class="truncate font-mono text-xs text-default">{{ value }}</code>
    <UButton
      icon="i-lucide-copy"
      size="xs"
      color="neutral"
      variant="ghost"
      :aria-label="t('common.copy')"
      @click="copy"
    />
  </span>
</template>
