<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const siteName = useRuntimeConfig().public.siteName;
</script>

<template>
  <footer class="mt-12 py-6 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-between gap-4">
    <p>© 2026 {{ siteName }} · 本地图片压缩工具</p>
    <div class="flex items-center gap-4">
      <NuxtLink :to="localePath('/privacy')" class="hover:underline">
        {{ t("common.privacy") }}
      </NuxtLink>
      <a href="https://tinystool.org" target="_blank" rel="noopener noreferrer" class="hover:underline">
        Tiny's Tool
      </a>
    </div>
  </footer>
</template>
