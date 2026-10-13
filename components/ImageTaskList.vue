<script setup lang="ts">
import { ref } from "vue";
import type { QueueItem, QueueStats } from "../composables/useCompressionQueue.client";
import { formatBytes } from "../lib/image/policy";
import { downloadTask, downloadTasksAsZip } from "../lib/image/download";

interface Props {
  tasks: QueueItem[];
  stats: QueueStats;
  isProcessing: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "cancel", taskId: string): void;
  (e: "retry", taskId: string): void;
  (e: "remove", taskId: string): void;
  (e: "clear-all"): void;
  (e: "compare", task: QueueItem): void;
}>();

const { t } = useI18n();
const isZipping = ref(false);
const zipError = ref<string | null>(null);

const handleDownloadAllZip = async () => {
  if (isZipping.value) return;
  isZipping.value = true;
  zipError.value = null;

  try {
    await downloadTasksAsZip(props.tasks, "tiny-images.zip");
  } catch (err: any) {
    zipError.value = err?.message || String(err);
  } finally {
    isZipping.value = false;
  }
};

const handleSingleDownload = (task: QueueItem) => {
  try {
    downloadTask(task);
  } catch (err) {
    console.error("Download failed:", err);
  }
};

const getSavingsPercent = (task: QueueItem): string => {
  if (!task.result || task.originalBytes <= 0) return "0";
  const percent = ((task.originalBytes - task.result.resultBytes) / task.originalBytes) * 100;
  return percent.toFixed(1);
};
</script>

<template>
  <div v-if="tasks.length > 0" class="space-y-4">
    <!-- 顶部总控与统计栏 -->
    <div
      class="glass rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 border border-white/10"
    >
      <div class="flex flex-wrap items-center gap-3">
        <!-- 任务总数与完成度 -->
        <div class="flex items-center gap-2">
          <span class="text-xs md:text-sm font-bold text-gray-200">
            {{ t("queue.totalCount", { count: stats.total }) }}
          </span>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            {{ stats.completed }}/{{ stats.total }}
          </span>
        </div>

        <!-- 累计节省 -->
        <div v-if="stats.completed > 0" class="flex items-center gap-1.5 text-xs text-gray-300 border-l border-white/10 pl-3">
          <span>{{ t("queue.totalSaved") }}:</span>
          <span class="font-mono font-bold text-emerald-400">
            {{ formatBytes(stats.totalSavedBytes) }}
          </span>
          <span
            v-if="stats.overallSavingsPercent > 0"
            class="px-1.5 py-0.2 rounded font-mono text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
          >
            -{{ stats.overallSavingsPercent.toFixed(1) }}%
          </span>
        </div>
      </div>

      <!-- 批量操作按钮组 -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5"
          @click="emit('clear-all')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span>{{ t("queue.clearAll") }}</span>
        </button>

        <button
          type="button"
          :disabled="stats.completed === 0 || isZipping"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          :class="
            stats.completed > 0 && !isZipping
              ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-gray-950 hover:opacity-95 shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-60'
          "
          @click="handleDownloadAllZip"
        >
          <svg
            v-if="!isZipping"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <svg
            v-else
            class="animate-spin w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>{{ isZipping ? t("queue.zipping") : t("queue.downloadAllZip") }}</span>
        </button>
      </div>
    </div>

    <!-- 错误横幅提示 -->
    <div
      v-if="zipError"
      class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between"
    >
      <span>{{ zipError }}</span>
      <button type="button" class="underline text-[11px]" @click="zipError = null">关闭</button>
    </div>

    <!-- 任务卡片列表 -->
    <div class="space-y-2.5">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="glass rounded-xl p-3.5 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4 transition-all duration-200 border border-white/5 hover:border-white/10"
      >
        <!-- 左侧：缩略图与信息 -->
        <div class="flex items-center gap-3.5 min-w-0 flex-1">
          <!-- 缩略图 -->
          <div
            class="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:8px_8px] bg-gray-900 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="task.previewUrl"
              :src="task.previewUrl"
              :alt="task.originalName"
              class="w-full h-full object-cover"
            />
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <!-- 文件名与体积状态 -->
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="text-xs md:text-sm font-semibold text-gray-200 truncate max-w-[200px] md:max-w-xs" :title="task.originalName">
                {{ task.originalName }}
              </h4>
              <span v-if="task.result?.extension" class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-gray-800 text-gray-400">
                {{ task.result.extension }}
              </span>
            </div>

            <!-- 体积变化与百分比 -->
            <div class="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span class="text-gray-400">{{ formatBytes(task.originalBytes) }}</span>

              <template v-if="task.status === 'success' && task.result">
                <span class="text-gray-500">→</span>
                <span class="text-gray-200 font-bold">{{ formatBytes(task.result.resultBytes) }}</span>
                <span
                  class="px-1.5 py-0.2 rounded font-bold"
                  :class="
                    task.result.resultBytes < task.originalBytes
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                  "
                >
                  {{ task.result.resultBytes < task.originalBytes ? `-${getSavingsPercent(task)}%` : '+0%' }}
                </span>
              </template>

              <template v-else-if="task.status === 'skipped'">
                <span class="text-purple-300 font-medium">✓ {{ t("queue.unchanged") }}</span>
              </template>

              <template v-else-if="task.status === 'failed'">
                <span class="text-rose-400 truncate max-w-[220px]" :title="task.errorMessage">
                  {{ task.errorMessage || t("queue.failed") }}
                </span>
              </template>
            </div>
          </div>
        </div>

        <!-- 中间：状态徽章 -->
        <div class="flex items-center gap-2 self-start sm:self-center">
          <!-- 排队中 -->
          <span
            v-if="task.status === 'queued'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-gray-800/80 text-gray-400 border border-white/5 flex items-center gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            {{ t("queue.queued") }}
          </span>

          <!-- 处理中 -->
          <span
            v-else-if="task.status === 'processing'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span>
              {{
                task.progressPhase === "decode"
                  ? t("queue.phaseDecode")
                  : task.progressPhase === "resize"
                  ? t("queue.phaseResize")
                  : task.progressPhase === "encode"
                  ? t("queue.phaseEncode")
                  : t("queue.processing")
              }}
            </span>
          </span>

          <!-- 成功 -->
          <span
            v-else-if="task.status === 'success'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
          >
            <span>✓</span>
            <span>{{ t("queue.success") }}</span>
          </span>

          <!-- 已跳过（PNG保持原图） -->
          <span
            v-else-if="task.status === 'skipped'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-purple-950/60 text-purple-300 border border-purple-500/30"
          >
            {{ t("queue.skipped") }}
          </span>

          <!-- 取消 -->
          <span
            v-else-if="task.status === 'cancelled'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-gray-800 text-gray-500"
          >
            {{ t("queue.cancelled") }}
          </span>

          <!-- 失败 -->
          <span
            v-else-if="task.status === 'failed'"
            class="px-2.5 py-1 rounded-full text-xs font-mono bg-rose-950/60 text-rose-300 border border-rose-500/30 flex items-center gap-1"
          >
            <span>✕</span>
            <span>{{ t("queue.failed") }}</span>
          </span>
        </div>

        <!-- 右侧：操作按钮组 -->
        <div class="flex items-center gap-1.5 self-end sm:self-center">
          <!-- 对比按钮 -->
          <button
            v-if="task.status === 'success' || task.status === 'skipped'"
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 border border-cyan-500/30 transition-all flex items-center gap-1"
            :title="t('compare.compareTitle')"
            @click="emit('compare', task)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
            <span class="hidden md:inline">{{ t("compare.button") }}</span>
          </button>

          <!-- 单个下载 -->
          <button
            v-if="task.status === 'success' || task.status === 'skipped'"
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-200 bg-white/10 hover:bg-white/20 border border-white/15 transition-all flex items-center gap-1"
            :title="t('queue.download')"
            @click="handleSingleDownload(task)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <span class="hidden md:inline">{{ t("queue.download") }}</span>
          </button>

          <!-- 取消按钮 (处理中或排队中) -->
          <button
            v-if="task.status === 'queued' || task.status === 'processing'"
            type="button"
            class="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 transition-all"
            @click="emit('cancel', task.id)"
          >
            {{ t("queue.cancel") }}
          </button>

          <!-- 重试按钮 (失败或取消) -->
          <button
            v-if="task.status === 'failed' || task.status === 'cancelled'"
            type="button"
            class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition-all flex items-center gap-1"
            @click="emit('retry', task.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
            <span>{{ t("queue.retry") }}</span>
          </button>

          <!-- 移除按钮 -->
          <button
            type="button"
            class="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
            :title="t('queue.remove')"
            @click="emit('remove', task.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
