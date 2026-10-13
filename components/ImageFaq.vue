<script setup lang="ts">
import { ref } from "vue";

const { t } = useI18n();

const openIndex = ref<number | null>(0);

const toggle = (index: number) => {
  openIndex.value = openIndex.value === index ? null : index;
};

const faqs = [
  {
    qKey: "faq.q1",
    aKey: "faq.a1",
  },
  {
    qKey: "faq.q2",
    aKey: "faq.a2",
  },
  {
    qKey: "faq.q3",
    aKey: "faq.a3",
  },
  {
    qKey: "faq.q4",
    aKey: "faq.a4",
  },
  {
    qKey: "faq.q5",
    aKey: "faq.a5",
  },
];
</script>

<template>
  <section class="mt-16 space-y-6">
    <div class="text-center space-y-2">
      <h2 class="text-xl md:text-2xl font-bold text-gray-100 tracking-tight">
        {{ t("faq.sectionTitle") }}
      </h2>
      <p class="text-xs md:text-sm text-gray-400 max-w-xl mx-auto">
        {{ t("faq.sectionSubtitle") }}
      </p>
    </div>

    <div class="max-w-3xl mx-auto space-y-3">
      <div
        v-for="(item, idx) in faqs"
        :key="idx"
        class="glass rounded-2xl border border-white/5 overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          class="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-xs md:text-sm text-gray-200 hover:text-cyan-300 transition-colors"
          @click="toggle(idx)"
        >
          <span>{{ t(item.qKey) }}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 flex-shrink-0 transition-transform duration-200 text-gray-400"
            :class="{ 'rotate-180 text-cyan-400': openIndex === idx }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          v-show="openIndex === idx"
          class="px-5 pb-4 text-xs md:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3"
        >
          {{ t(item.aKey) }}
        </div>
      </div>
    </div>
  </section>
</template>
