<script setup lang="ts">
import {
  ADMIN_NAVIGATION,
  findAdminNavItem,
  isAdminNavActive,
} from "~/utils/admin-navigation";

const { t } = useI18n();
const route = useRoute();
const admin = useAdminStore();

const mobileMenuOpen = ref(false);

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  },
);

onMounted(() => {
  void admin.resolve();
});

const current = computed(() => findAdminNavItem(route.path));

function sectionCount(sectionKey?: string): number | null {
  if (!sectionKey) return null;
  const list = admin.catalog[sectionKey];
  return Array.isArray(list) ? list.length : null;
}

const userLabel = computed(() =>
  admin.token === "dev-admin" ? "dev-admin" : "Staff",
);

const userMenuItems = computed(() => [
  [
    {
      label: t("admin.nav.settings"),
      icon: "i-lucide-settings",
      to: "/admin/settings",
    },
  ],
  [
    {
      label: t("admin.disconnect"),
      icon: "i-lucide-log-out",
      color: "error" as const,
      onSelect: () => {
        admin.disconnect();
        void navigateTo("/admin");
      },
    },
  ],
]);
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Unauthenticated Login Screen -->
    <div
      v-if="!admin.isAuthenticated"
      class="flex min-h-screen items-center justify-center p-4 bg-muted/20"
    >
      <div class="w-full max-w-md space-y-6">
        <div class="text-center space-y-2">
          <div
            class="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-2"
          >
            <UIcon name="i-lucide-shield-check" class="size-8" />
          </div>
          <div class="flex items-center justify-center gap-2">
            <h1 class="text-2xl font-bold tracking-tight">
              {{ t("admin.title") }}
            </h1>
            <CommonInfoTooltip :text="t('admin.tokenHint')" wide />
          </div>
        </div>

        <UCard>
          <form class="space-y-4" @submit.prevent="admin.signInWithToken()">
            <UFormField :label="t('admin.token')">
              <template #label>
                <span class="inline-flex items-center gap-1.5">
                  <span>{{ t("admin.token") }}</span>
                  <CommonInfoTooltip
                    :text="t('admin.fieldHints.adminToken')"
                    wide
                  />
                </span>
              </template>
              <UInput
                v-model="admin.tokenInput"
                type="password"
                autocomplete="off"
                class="w-full"
                placeholder="••••••••••••"
              />
            </UFormField>

            <div class="flex flex-col gap-2 pt-2">
              <UButton
                type="submit"
                block
                :loading="admin.busy"
                :disabled="!admin.tokenInput"
              >
                {{ t("admin.load") }}
              </UButton>

              <UButton
                v-if="admin.devEnabled"
                variant="outline"
                color="neutral"
                block
                icon="i-lucide-terminal"
                :loading="admin.busy"
                @click="admin.signInDev"
              >
                {{ t("admin.signInDev") }}
              </UButton>
            </div>
          </form>
        </UCard>

        <UAlert
          v-if="admin.error"
          color="error"
          :title="t('admin.failed')"
          icon="i-lucide-alert-circle"
        />
      </div>
    </div>

    <!-- Authenticated Admin Interface with Left Sidebar (like Blogger Dog) -->
    <div v-else class="min-h-screen bg-default">
      <!-- Fixed Header -->
      <header
        class="fixed inset-x-0 top-0 z-20 h-14 border-b border-default bg-default/95 backdrop-blur"
      >
        <div class="flex items-center gap-3 px-4 h-full">
          <UButton
            class="md:hidden"
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mobileMenuOpen = !mobileMenuOpen"
          />

          <NuxtLink
            to="/admin"
            class="font-semibold text-sm tracking-tight shrink-0 flex items-center gap-2"
          >
            <UIcon name="i-lucide-shield" class="size-4 text-primary" />
            <span>{{ t("admin.title") }}</span>
          </NuxtLink>

          <span
            v-if="current"
            class="text-xs text-muted hidden sm:inline border-l border-default pl-3 ml-1"
          >
            {{ t(current.group.labelKey) }} · {{ t(current.item.labelKey) }}
          </span>

          <div class="ml-auto flex items-center gap-2 sm:gap-3">
            <UDropdownMenu :items="userMenuItems" :content="{ align: 'end' }">
              <UButton
                color="neutral"
                variant="ghost"
                class="flex items-center gap-2"
                :aria-label="userLabel"
              >
                <UAvatar icon="i-lucide-user" size="xs" />
                <span class="text-sm font-medium hidden sm:inline">
                  {{ userLabel }}
                </span>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-3.5 text-muted hidden sm:inline"
                />
              </UButton>
            </UDropdownMenu>
          </div>
        </div>
      </header>

      <!-- Backdrop for mobile menu -->
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-10 bg-black/50 md:hidden"
        @click="mobileMenuOpen = false"
      />

      <!-- Left Sidebar (Fixed rail like Blogger Dog) -->
      <aside
        class="fixed inset-y-0 left-0 z-10 w-60 pt-14 border-r border-default bg-default overflow-y-auto transition-transform duration-200 md:translate-x-0"
        :class="
          mobileMenuOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0'
        "
      >
        <nav class="p-3 space-y-5">
          <div v-for="group in ADMIN_NAVIGATION" :key="group.labelKey">
            <div
              class="flex items-center gap-2 px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted"
            >
              <UIcon :name="group.icon" class="size-3.5" />
              <span>{{ t(group.labelKey) }}</span>
            </div>

            <div class="space-y-0.5">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md transition-colors"
                :class="
                  isAdminNavActive(route.path, item.to)
                    ? 'bg-muted text-default font-medium'
                    : 'text-muted hover:bg-muted/50 hover:text-default'
                "
              >
                <UIcon :name="item.icon" class="size-4 shrink-0" />
                <span class="truncate">{{ t(item.labelKey) }}</span>

                <UBadge
                  v-if="sectionCount(item.sectionKey) !== null"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="ml-auto"
                >
                  {{ sectionCount(item.sectionKey) }}
                </UBadge>
              </NuxtLink>
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="pt-14 md:pl-60 min-h-screen bg-muted/10">
        <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
          <UAlert
            v-if="admin.error"
            color="error"
            :title="t('admin.failed')"
            icon="i-lucide-alert-circle"
            class="mb-4"
          />

          <UAlert
            v-if="admin.secret"
            color="warning"
            :title="t('admin.secret')"
            :description="admin.secret"
            icon="i-lucide-key"
            class="mb-4"
          />

          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
