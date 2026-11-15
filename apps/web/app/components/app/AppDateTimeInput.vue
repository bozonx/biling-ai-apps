<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
  }>(),
  {
    modelValue: "",
    disabled: false,
    required: false,
    placeholder: undefined,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

/**
 * Converts ISO string (e.g. 2026-11-15T20:00:00.000Z) to datetime-local string (YYYY-MM-DDTHH:mm)
 */
const localValue = computed(() => {
  if (!props.modelValue) return "";
  try {
    const d = new Date(props.modelValue);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
});

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const val = target.value;
  if (!val) {
    emit("update:modelValue", "");
    return;
  }
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      emit("update:modelValue", d.toISOString());
    }
  } catch {
    emit("update:modelValue", val);
  }
}

function setNow() {
  const now = new Date();
  emit("update:modelValue", now.toISOString());
}

function clear() {
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="flex items-center gap-2 w-full">
    <UInput
      type="datetime-local"
      :model-value="localValue"
      :disabled="disabled"
      :required="required"
      :placeholder="placeholder"
      class="w-full"
      @input="onInput"
    />
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-lucide-clock"
      :disabled="disabled"
      :title="t('common.now') || 'Now'"
      @click="setNow"
    >
      {{ t("common.now") }}
    </UButton>
    <UButton
      v-if="!required && modelValue"
      variant="ghost"
      color="neutral"
      size="sm"
      icon="i-lucide-x"
      :disabled="disabled"
      @click="clear"
    />
  </div>
</template>
