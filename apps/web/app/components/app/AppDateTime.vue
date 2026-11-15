<script setup lang="ts">
const props = defineProps<{ value: string | Date }>();
const { locale } = useI18n();
const date = computed(() => new Date(props.value));
const text = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date.value),
);
</script>

<template>
  <time :datetime="date.toISOString()" class="tabular-nums">{{ text }}</time>
</template>
