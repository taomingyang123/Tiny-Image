<script setup lang="ts">
const { locale } = useI18n();

const htmlLang = computed(() => {
  if (locale.value === "zh") return "zh-CN";
  if (locale.value === "ja") return "ja";
  return "en";
});

useHead(() => ({ htmlAttrs: { lang: htmlLang.value } }));
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
