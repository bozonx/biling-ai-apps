<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: number | string | null;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
  }>(),
  {
    modelValue: undefined,
    min: undefined,
    max: undefined,
    step: 1,
    placeholder: undefined,
    disabled: false,
    required: false,
    size: "md",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: number | string): void;
  (e: "change", value: number | string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);

const numericValue = computed<number | null>(() => {
  if (
    props.modelValue === undefined ||
    props.modelValue === null ||
    props.modelValue === ""
  ) {
    return null;
  }
  const n = Number(props.modelValue);
  return Number.isFinite(n) ? n : null;
});

function clamp(val: number): number {
  let res = val;
  if (props.min !== undefined && res < props.min) res = props.min;
  if (props.max !== undefined && res > props.max) res = props.max;
  return res;
}

function updateValue(val: number | string) {
  if (typeof val === "number") {
    const clamped = clamp(val);
    emit("update:modelValue", clamped);
    emit("change", clamped);
  } else {
    emit("update:modelValue", val);
    emit("change", val);
  }
}

function stepBy(direction: number) {
  if (props.disabled) return;
  const current = numericValue.value ?? props.min ?? 0;
  const next = clamp(current + direction * props.step);
  updateValue(next);
}

function onWheel(event: WheelEvent) {
  if (!isFocused.value || props.disabled) return;
  event.preventDefault();
  const direction = event.deltaY < 0 ? 1 : -1;
  stepBy(direction);
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const raw = target.value;
  if (raw === "") {
    updateValue("");
    return;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    updateValue(parsed);
  } else {
    updateValue(raw);
  }
}

function onFocus() {
  isFocused.value = true;
}

function onBlur() {
  isFocused.value = false;
  if (numericValue.value !== null) {
    const clamped = clamp(numericValue.value);
    if (clamped !== numericValue.value) {
      updateValue(clamped);
    }
  }
}
</script>

<template>
  <div class="relative flex items-center w-full">
    <UInput
      ref="inputRef"
      type="number"
      :model-value="
        modelValue !== undefined && modelValue !== null
          ? String(modelValue)
          : ''
      "
      :min="min"
      :max="max"
      :step="step"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :size="size"
      class="w-full"
      :ui="{ trailing: 'pr-1.5' }"
      @wheel="onWheel"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    >
      <template #trailing>
        <div class="flex items-center gap-0.5">
          <UButton
            icon="i-lucide-minus"
            size="xs"
            variant="ghost"
            color="neutral"
            tabindex="-1"
            :disabled="
              disabled ||
              (min !== undefined &&
                numericValue !== null &&
                numericValue <= min)
            "
            class="h-5 w-5 p-0 flex items-center justify-center cursor-pointer"
            @click.prevent="stepBy(-1)"
          />
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            color="neutral"
            tabindex="-1"
            :disabled="
              disabled ||
              (max !== undefined &&
                numericValue !== null &&
                numericValue >= max)
            "
            class="h-5 w-5 p-0 flex items-center justify-center cursor-pointer"
            @click.prevent="stepBy(1)"
          />
        </div>
      </template>
    </UInput>
  </div>
</template>
