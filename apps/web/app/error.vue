<script setup lang="ts">
import type { NuxtError } from "#app";
const props = defineProps<{ error: NuxtError }>();
const { t } = useI18n();
const notFound = computed(() => props.error.statusCode === 404);
</script>

<template>
  <UApp>
    <NuxtLayout name="auth">
      <div class="space-y-4 text-center">
        <p class="text-5xl font-semibold text-primary tabular-nums">
          {{ error.statusCode }}
        </p>
        <h1 class="text-lg font-semibold text-highlighted">
          {{ notFound ? t("errors.pageNotFound") : t("errors.title") }}
        </h1>
        <p class="text-sm text-muted">
          {{
            notFound ? t("errors.pageNotFoundDescription") : t("errors.UNKNOWN")
          }}
        </p>
        <UButton
          :label="t('common.goHome')"
          icon="i-lucide-house"
          @click="clearError({ redirect: '/' })"
        />
      </div>
    </NuxtLayout>
  </UApp>
</template>
