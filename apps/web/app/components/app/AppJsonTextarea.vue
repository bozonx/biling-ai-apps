<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string | object | null;
    template?: object | string;
    disabled?: boolean;
    placeholder?: string;
    rows?: number;
  }>(),
  {
    modelValue: "",
    template: undefined,
    disabled: false,
    placeholder: "{\n  \n}",
    rows: 5,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

const text = ref("");

function syncFromProps() {
  if (typeof props.modelValue === "object" && props.modelValue !== null) {
    text.value = JSON.stringify(props.modelValue, null, 2);
  } else {
    text.value = String(props.modelValue ?? "");
  }
}

watch(
  () => props.modelValue,
  () => {
    if (typeof props.modelValue === "object" && props.modelValue !== null) {
      const formatted = JSON.stringify(props.modelValue, null, 2);
      if (formatted !== text.value) {
        text.value = formatted;
      }
    }
  },
  { immediate: true },
);

onMounted(() => {
  syncFromProps();
});

const jsonError = computed<string | null>(() => {
  const trimmed = text.value.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return null;
  } catch (err: unknown) {
    if (err instanceof Error) {
      return err.message;
    }
    return "Invalid JSON";
  }
});

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  text.value = target.value;
  emit("update:modelValue", text.value);
}

function prettify() {
  const trimmed = text.value.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    text.value = JSON.stringify(parsed, null, 2);
    emit("update:modelValue", text.value);
  } catch {
    // If invalid JSON, leave as is
  }
}

function insertTemplate() {
  if (!props.template) return;
  const tpl =
    typeof props.template === "string"
      ? props.template
      : JSON.stringify(props.template, null, 2);
  text.value = tpl;
  emit("update:modelValue", tpl);
}
</script>

<template>
  <div class="space-y-1.5 w-full">
    <div class="flex items-center justify-between text-xs">
      <span v-if="jsonError" class="text-error font-mono text-[11px]">
        {{ t("admin.jsonInvalid") }}: {{ jsonError }}
      </span>
      <span v-else class="text-muted text-[11px]">
        {{ t("admin.jsonValid") }}
      </span>

      <div class="flex items-center gap-2">
        <UButton
          v-if="template"
          variant="link"
          color="neutral"
          size="xs"
          class="p-0 text-xs"
          :disabled="disabled"
          @click="insertTemplate"
        >
          {{ t("admin.insertTemplate") }}
        </UButton>
        <UButton
          v-if="text.trim() && !jsonError"
          variant="link"
          color="neutral"
          size="xs"
          class="p-0 text-xs"
          :disabled="disabled"
          @click="prettify"
        >
          {{ t("admin.formatJson") }}
        </UButton>
      </div>
    </div>

    <UTextarea
      :model-value="text"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full font-mono text-xs"
      :class="{ 'ring-1 ring-error border-error': jsonError }"
      @input="onInput"
    />
  </div>
</template>
