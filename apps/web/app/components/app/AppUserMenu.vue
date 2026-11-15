<script setup lang="ts">
defineProps<{ compact?: boolean }>();
const { t } = useI18n();
const auth = useAuthStore();
const label = computed(() =>
  auth.method === "dev" ? t("auth.devAccount") : t("auth.account"),
);
const items = computed(() => [
  [
    {
      type: "label" as const,
      label: label.value,
      description: auth.account?.accountId,
    },
  ],
  [
    { label: t("nav.settings"), icon: "i-lucide-settings", to: "/settings" },
    {
      label: t("settings.account.title"),
      icon: "i-lucide-user",
      to: "/settings/account",
    },
  ],
  [
    {
      label: t("auth.signOut"),
      icon: "i-lucide-log-out",
      color: "error" as const,
      onSelect: () => auth.signOut(),
    },
  ],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start', side: 'top' }"
    class="w-full"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="compact"
      class="justify-start"
      :aria-label="label"
    >
      <UAvatar icon="i-lucide-user" size="xs" />
      <span v-if="!compact" class="min-w-0 flex-1 truncate text-left">{{
        label
      }}</span>
      <UIcon
        v-if="!compact"
        name="i-lucide-chevrons-up-down"
        class="size-4 text-dimmed"
      />
    </UButton>
  </UDropdownMenu>
</template>
