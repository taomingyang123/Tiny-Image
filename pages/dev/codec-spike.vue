<script setup lang="ts">
import { ref } from "vue";
import type { SpikeResultItem } from "~/workers/spike.worker";

usePageSeo({
  title: "Codec Spike - Web Worker & WASM 测试",
  description: "内部技术验证页面，不对搜索引擎开放",
  noIndex: true,
});

const isRunning = ref(false);
const errorMsg = ref<string | null>(null);
const spikeResults = ref<SpikeResultItem[]>([]);
const allPassed = ref<boolean | null>(null);

const runSpike = () => {
  if (isRunning.value) return;
  isRunning.value = true;
  errorMsg.value = null;
  spikeResults.value = [];
  allPassed.value = null;

  try {
    const worker = new Worker(
      new URL("../../workers/spike.worker.ts", import.meta.url),
      { type: "module" },
    );

    const timeoutTimer = setTimeout(() => {
      worker.terminate();
      isRunning.value = false;
      errorMsg.value = "Worker 超时 (30s)";
    }, 30000);

    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timeoutTimer);
      if (event.data?.type === "SPIKE_RESULT") {
        spikeResults.value = event.data.results;
        allPassed.value = event.data.allPassed;
      }
      isRunning.value = false;
      worker.terminate();
    };

    worker.onerror = (err) => {
      clearTimeout(timeoutTimer);
      isRunning.value = false;
      errorMsg.value = `Worker 错误: ${err.message || "未知异常"}`;
      worker.terminate();
    };

    worker.postMessage({ type: "RUN_SPIKE" });
  } catch (err: any) {
    isRunning.value = false;
    errorMsg.value = `启动 Worker 失败: ${err?.message || err}`;
  }
};
</script>

<template>
  <main class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <header class="space-y-2 border-b border-gray-200 dark:border-gray-800 pb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        WASM 编解码 Spike（阶段 0 技术验证）
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        此页面用于验证 `@jsquash/jpeg`、`@jsquash/webp`、`@jsquash/oxipng` 在生产静态站 Web Worker 环境下的实际运行与 WASM 资源加载。
      </p>
    </header>

    <div class="space-y-4">
      <button
        id="run-spike-btn"
        type="button"
        class="px-5 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
        :disabled="isRunning"
        @click="runSpike"
      >
        <span v-if="isRunning">正在执行 WASM Worker 测试...</span>
        <span v-else>启动 Worker 编解码验证</span>
      </button>

      <div v-if="errorMsg" class="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
        {{ errorMsg }}
      </div>

      <div v-if="spikeResults.length > 0" class="space-y-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">测试结果</h2>
        <div class="grid gap-3">
          <div
            v-for="item in spikeResults"
            :key="item.format"
            class="p-4 rounded-xl border flex items-center justify-between"
            :class="item.success ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'"
          >
            <div>
              <p class="font-bold uppercase tracking-wider text-sm">{{ item.format }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                输入: {{ item.inputBytes }} B → 输出: {{ item.outputBytes }} B
              </p>
              <p v-if="item.error" class="text-xs text-red-600 mt-1">错误: {{ item.error }}</p>
            </div>
            <span
              class="px-2.5 py-1 rounded-full text-xs font-semibold"
              :class="item.success ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'"
            >
              {{ item.success ? '通过 PASS' : '失败 FAIL' }}
            </span>
          </div>
        </div>

        <div
          v-if="allPassed !== null"
          class="p-4 rounded-xl text-center font-bold"
          :class="allPassed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'"
        >
          {{ allPassed ? '🎉 阶段 0 Spike 验证通过：所有格式 WASM 在 Worker 内编解码正常！' : '❌ 阶段 0 Spike 验证未通过，请排查 WASM/Worker 配置。' }}
        </div>
      </div>
    </div>
  </main>
</template>
