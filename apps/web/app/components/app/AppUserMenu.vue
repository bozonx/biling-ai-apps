<script setup lang="ts">
defineProps<{ compact?: boolean }>();
const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const active = computed(() => isNavActive(route.path, "/settings"));
const label = computed(() =>
  auth.method === "dev" ? t("auth.devAccount") : t("auth.account"),
);
</script>

<template>
  <UTooltip :text="t('nav.settings')">
    <UButton
      to="/settings"
      color="neutral"
      :variant="active ? 'subtle' : 'ghost'"
      class="flex items-center gap-2"
      :aria-label="label"
      :aria-current="active ? 'page' : undefined"
    >
      <UAvatar icon="i-lucide-user" size="xs" />
      <span v-if="!compact" class="hidden max-w-40 truncate text-sm sm:inline">
        {{ label }}
      </span>
    </UButton>
  </UTooltip>
</template>
