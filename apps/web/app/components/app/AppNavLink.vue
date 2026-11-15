<script setup lang="ts">
const props = defineProps<{ item: NavItem; compact?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const { t } = useI18n();
const active = computed(() => isNavActive(route.path, props.item.to));
</script>

<template>
  <UTooltip
    :text="t(item.label)"
    :disabled="!compact"
    :content="{ side: 'right' }"
  >
    <NuxtLink
      :to="item.to"
      class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
      :class="[
        active
          ? 'bg-elevated text-highlighted'
          : 'text-muted hover:bg-elevated/60 hover:text-highlighted',
        compact ? 'justify-center' : '',
      ]"
      :aria-current="active ? 'page' : undefined"
      @click="emit('navigate')"
    >
      <UIcon :name="item.icon" class="size-4 shrink-0" />
      <span v-if="!compact" class="truncate">{{ t(item.label) }}</span>
    </NuxtLink>
  </UTooltip>
</template>
