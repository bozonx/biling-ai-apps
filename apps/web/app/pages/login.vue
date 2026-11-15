<script setup lang="ts">
definePageMeta({ layout: "auth" });
const { t } = useI18n();
useHead({ title: () => t("auth.signInTitle") });

const config = useRuntimeConfig();
const auth = useAuthStore();
const route = useRoute();
const loading = ref(false);
const error = ref<unknown>(null);
const devEnabled = computed(() => config.public.devLoginEnabled === true);

function redirectTarget() {
  const value = route.query.redirect;
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/";
}

async function signInDev() {
  loading.value = true;
  error.value = null;
  try {
    await auth.signInDev();
    await navigateTo(redirectTarget());
  } catch (cause) {
    error.value = cause;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard :ui="{ body: 'space-y-5 sm:p-6' }">
    <div class="space-y-1 text-center">
      <h1 class="text-lg font-semibold text-highlighted">
        {{ t("auth.signInTitle") }}
      </h1>
      <p class="text-sm text-muted">{{ t("auth.signInDescription") }}</p>
    </div>

    <UButton
      block
      size="lg"
      icon="i-lucide-key-round"
      :label="t('auth.signInSso')"
      disabled
    />
    <p class="-mt-3 text-center text-xs text-dimmed">
      {{ t("auth.ssoUnavailable") }}
    </p>

    <template v-if="devEnabled">
      <USeparator :label="t('auth.or')" />
      <UButton
        block
        size="lg"
        color="neutral"
        variant="outline"
        icon="i-lucide-terminal"
        :label="t('auth.signInDev')"
        :loading="loading"
        @click="signInDev"
      />
      <p class="-mt-3 text-center text-xs text-dimmed">
        {{ t("auth.devHint") }}
      </p>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :description="t(errorMessageKey(error))"
    />
  </UCard>
</template>
