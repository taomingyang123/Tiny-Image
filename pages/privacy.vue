<script setup lang="ts">
const { t } = useI18n();

usePageSeo({
  titleKey: "privacy.title",
  descriptionKey: "privacy.description",
  schemaType: "WebPage",
});
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
    <header class="space-y-3 border-b border-white/10 pb-6">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>{{ t("privacy.badge") }}</span>
      </div>

      <h1 class="text-2xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-200 to-gray-400 tracking-tight">
        {{ t("privacy.title") }}
      </h1>

      <p class="text-xs md:text-sm text-gray-400 font-mono">
        Tiny Image (image.tinystool.org) · 100% Client-Side Processing
      </p>
    </header>

    <article class="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
      <section class="glass rounded-2xl p-6 border border-white/10 space-y-2.5">
        <h2 class="text-base md:text-lg font-bold text-gray-100 flex items-center gap-2">
          <span class="text-cyan-400 font-mono">#</span>
          <span>{{ t("privacy.s1Title") }}</span>
        </h2>
        <p class="text-gray-400 text-xs md:text-sm leading-relaxed">
          {{ t("privacy.s1Content") }}
        </p>
      </section>

      <section class="glass rounded-2xl p-6 border border-white/10 space-y-2.5">
        <h2 class="text-base md:text-lg font-bold text-gray-100 flex items-center gap-2">
          <span class="text-cyan-400 font-mono">#</span>
          <span>{{ t("privacy.s2Title") }}</span>
        </h2>
        <p class="text-gray-400 text-xs md:text-sm leading-relaxed">
          {{ t("privacy.s2Content") }}
        </p>
      </section>

      <section class="glass rounded-2xl p-6 border border-white/10 space-y-2.5">
        <h2 class="text-base md:text-lg font-bold text-gray-100 flex items-center gap-2">
          <span class="text-cyan-400 font-mono">#</span>
          <span>{{ t("privacy.s3Title") }}</span>
        </h2>
        <p class="text-gray-400 text-xs md:text-sm leading-relaxed">
          {{ t("privacy.s3Content") }}
        </p>
      </section>

      <section class="glass rounded-2xl p-6 border border-white/10 space-y-2.5">
        <h2 class="text-base md:text-lg font-bold text-gray-100 flex items-center gap-2">
          <span class="text-cyan-400 font-mono">#</span>
          <span>{{ t("privacy.s4Title") }}</span>
        </h2>
        <p class="text-gray-400 text-xs md:text-sm leading-relaxed">
          {{ t("privacy.s4Content") }}
        </p>
      </section>
    </article>
  </main>
</template>
