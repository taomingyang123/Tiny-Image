<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { locale } = useI18n();

const htmlLang = computed(() => {
  if (locale.value === "zh") return "zh-CN";
  if (locale.value === "ja") return "ja";
  return "en";
});

useHead(() => ({
  htmlAttrs: {
    lang: htmlLang.value,
    class: "dark",
  },
}));
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
