<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const siteName = useRuntimeConfig().public.siteName;
const isNotFound = computed(() => props.error.statusCode === 404);
const title = computed(() => t(isNotFound.value ? "error.notFound" : "error.unavailable"));

const htmlLang = computed(() => {
  if (locale.value === "zh") return "zh-CN";
  if (locale.value === "ja") return "ja";
  return "en";
});

useHead(() => ({
  title: `${title.value} | ${siteName}`,
  htmlAttrs: { lang: htmlLang.value },
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
</script>

<template>
  <main class="site-container">
    <h1>{{ error.statusCode }} · {{ title }}</h1>
    <p>{{ t("error.description") }}</p>
    <button type="button" class="btn" @click="clearError({ redirect: localePath('/') })">{{ t("common.home") }}</button>
  </main>
</template>
