<script setup lang="ts">
import { ref } from "vue";
import type { QueueItem } from "../composables/useCompressionQueue.client";
import { downloadTask } from "../lib/image/download";

const { t } = useI18n();

usePageSeo({
  titleKey: "home.title",
  descriptionKey: "home.description",
  schemaType: "WebApplication",
  applicationCategory: "MultimediaApplication",
});

const faqJsonLd = computed(() => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [1, 2, 3, 4, 5].map((i) => ({
    "@type": "Question",
    name: t(`faq.q${i}`),
    acceptedAnswer: {
      "@type": "Answer",
      text: t(`faq.a${i}`),
    },
  })),
}));

useHead(() => ({
  script: [
    {
      type: "application/ld+json",
      key: "faq-ld-json",
      children: JSON.stringify(faqJsonLd.value).replace(/</g, "\\u003c"),
    },
  ],
}));

// 客户端压缩队列与状态管理
const queue = useCompressionQueue();
const {
  tasks,
  globalOptions,
  admissionError,
  isProcessing,
  stats,
  addFiles,
  cancelTask,
  retryTask,
  recompressAll,
  removeTask,
  clearAll,
} = queue;

// 画质前后对比弹窗状态
const isCompareOpen = ref(false);
const activeCompareTask = ref<QueueItem | null>(null);

const handleOpenCompare = (task: QueueItem) => {
  activeCompareTask.value = task;
  isCompareOpen.value = true;
};

const handleDownloadActiveCompare = () => {
  if (activeCompareTask.value) {
    downloadTask(activeCompareTask.value);
  }
};
</script>

<template>
  <main class="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
    <!-- Hero 视觉区 -->
    <header class="text-center space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10">
        <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        <span>{{ t("settings.localSafeBadge") }}</span>
      </div>

      <h1 class="text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-200 to-gray-400 tracking-tight leading-tight">
        {{ t("home.heading") }}
      </h1>

      <p class="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
        {{ t("home.subheading") }}
      </p>

      <!-- 核心特点亮点 -->
      <div class="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-gray-400">
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>{{ t("home.featureNoUpload") }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
          </svg>
          <span>{{ t("home.featureFastWasm") }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
          <span>{{ t("home.featureBatch") }}</span>
        </div>
      </div>
    </header>

    <!-- 客户端核心工作区 -->
    <ClientOnly>
      <div class="space-y-6">
        <!-- 压缩与格式配置面板 -->
        <ImageSettings
          v-model="globalOptions"
          :disabled="isProcessing"
        />

        <!-- 拖拽上传区 -->
        <ImageDropzone
          @files-added="addFiles"
        />

        <p v-if="admissionError" role="alert" class="text-sm text-amber-300">{{ t(`errors.${admissionError}`) }}</p>

        <!-- 任务列表与控制栏 -->
        <ImageTaskList
          :tasks="tasks"
          :stats="stats"
          :is-processing="isProcessing"
          @cancel="cancelTask"
          @retry="retryTask"
          @recompress-all="recompressAll"
          @remove="removeTask"
          @clear-all="clearAll"
          @compare="handleOpenCompare"
        />
      </div>

      <!-- SSG 预渲染占位骨架屏 -->
      <template #fallback>
        <div class="glass rounded-3xl p-12 text-center border border-white/10 space-y-4">
          <div class="w-12 h-12 rounded-full bg-cyan-500/20 mx-auto animate-pulse"></div>
          <p class="text-sm text-gray-400">{{ t("home.engineLoading") }}</p>
        </div>
      </template>
    </ClientOnly>

    <!-- 画质对比弹窗 -->
    <ImageCompareModal
      v-model="isCompareOpen"
      :original-url="activeCompareTask?.previewUrl"
      :result-url="activeCompareTask?.resultUrl"
      :original-name="activeCompareTask?.originalName"
      :original-bytes="activeCompareTask?.originalBytes"
      :result-bytes="activeCompareTask?.result?.resultBytes"
      :width="activeCompareTask?.result?.width || activeCompareTask?.originalWidth"
      :height="activeCompareTask?.result?.height || activeCompareTask?.originalHeight"
      @download="handleDownloadActiveCompare"
    />

    <!-- SEO 常见问答模块 -->
    <ImageFaq />
  </main>
</template>
