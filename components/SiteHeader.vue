<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const siteName = useRuntimeConfig().public.siteName;

const languages = [
  { code: "zh", label: "中文", lang: "zh-CN" },
  { code: "en", label: "EN", lang: "en" },
  { code: "ja", label: "日本語", lang: "ja" },
] as const;
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-800">
    <NuxtLink :to="localePath('/')" class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
      {{ siteName }}
    </NuxtLink>
    <nav :aria-label="t('common.navigation')" class="flex items-center gap-4 text-sm font-medium">
      <NuxtLink :to="localePath('/')" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
        {{ t("common.home") }}
      </NuxtLink>
      <NuxtLink :to="localePath('/privacy')" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
        {{ t("common.privacy") }}
      </NuxtLink>
      <div class="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3">
        <NuxtLink
          v-for="item in languages"
          :key="item.code"
          :to="switchLocalePath(item.code)"
          :lang="item.lang"
          class="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
