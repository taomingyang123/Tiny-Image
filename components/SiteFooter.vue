<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const siteName = useRuntimeConfig().public.siteName;
</script>

<template>
  <footer class="mt-16 py-8 border-t border-white/10 text-xs md:text-sm text-gray-500 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
      <p>© 2026 {{ siteName }} · {{ t("common.siteTagline") }}</p>
    </div>
    <div class="flex items-center gap-4">
      <NuxtLink :to="localePath('/privacy')" class="hover:text-cyan-300 transition-colors">
        {{ t("common.privacy") }}
      </NuxtLink>
      <a href="/third-party-licenses.txt" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-300 transition-colors">{{ t("common.licenses") }}</a>
      <a href="https://tinystool.org" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-300 transition-colors">
        Tiny's Tool
      </a>
    </div>
  </footer>
</template>
