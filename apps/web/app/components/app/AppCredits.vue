<script setup lang="ts">
/** Renders a milli-credit amount in the current locale. */
const props = defineProps<{ milli: string | null | undefined }>();
const { locale } = useI18n();
const text = computed(() =>
  props.milli == null ? "—" : formatCredits(props.milli, locale.value),
);
</script>

<template>
  <span class="tabular-nums">{{ text }}</span>
</template>
