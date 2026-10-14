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
  <header class="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-white/10">
    <NuxtLink :to="localePath('/')" class="flex items-center gap-2.5 group">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-purple-500 p-0.5 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
        <div class="w-full h-full bg-gray-950 rounded-[10px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      </div>
      <span class="text-lg md:text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300">
        {{ siteName }}
      </span>
    </NuxtLink>
    <nav :aria-label="t('common.navigation')" class="flex items-center gap-4 text-sm font-medium">
      <NuxtLink :to="localePath('/')" class="text-gray-400 hover:text-cyan-300 transition-colors">
        {{ t("common.home") }}
      </NuxtLink>
      <NuxtLink :to="localePath('/privacy')" class="text-gray-400 hover:text-cyan-300 transition-colors">
        {{ t("common.privacy") }}
      </NuxtLink>
      <div class="flex items-center gap-1.5 border-l border-white/10 pl-3">
        <NuxtLink
          v-for="item in languages"
          :key="item.code"
          :to="switchLocalePath(item.code)"
          :lang="item.lang"
          class="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-all font-mono"
          active-class="font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 shadow-sm"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
