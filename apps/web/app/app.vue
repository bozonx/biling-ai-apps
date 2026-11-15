<script setup lang="ts">
const { locale } = useI18n();
const config = useRuntimeConfig();
useHead({
  htmlAttrs: { lang: locale },
  titleTemplate: (title) =>
    title ? `${title} · ${config.public.appName}` : config.public.appName,
});
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
