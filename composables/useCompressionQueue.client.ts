import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";
import type {
  CompressionOptions,
  CompressionResult,
  CompressionStatus,
  CompressionErrorCode,
  SupportedInput,
} from "../lib/image/types";
import { detectImageFormat } from "../lib/image/magic";
import {
  probeDimensions,
  isPixelLimitExceeded,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_PIXELS_DESKTOP,
  DEFAULT_MAX_PIXELS_MOBILE,
  MAX_BATCH_FILES,
} from "../lib/image/dimensions";
import { WorkerClient, WorkerTaskError } from "../lib/image/workerClient";

export interface QueueItem {
  id: string;
  file: File;
  originalName: string;
  originalBytes: number;
  status: CompressionStatus;
  optionsSnapshot: CompressionOptions;
  detectedMime?: SupportedInput;
  originalWidth?: number;
  originalHeight?: number;
  progressPhase?: "decode" | "resize" | "encode" | "finalize";
  result?: CompressionResult;
  resultBlob?: Blob;
  resultUrl?: string;
  previewUrl?: string;
  errorCode?: CompressionErrorCode;
  errorMessage?: string;
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  success: number;
  skipped: number;
  failed: number;
  cancelled: number;
  totalOriginalBytes: number;
  totalResultBytes: number;
  totalSavedBytes: number;
  overallSavingsPercent: number;
}

export interface CompressionQueueOptions {
  workerClient?: WorkerClient;
  defaultOptions?: Partial<CompressionOptions>;
  maxFileBytes?: number;
  maxPixels?: number;
}

/**
 * 将 Vue 响应式 Options 深度还原为无 Proxy 的原生 Plain Object
 * 杜绝 worker.postMessage 触发 DataCloneError: #<Object> could not be cloned
 */
export function toPlainOptions(opt: CompressionOptions): CompressionOptions {
  return {
    output: opt.output,
    quality: Number(opt.quality),
    maxLongEdge:
      opt.maxLongEdge !== null && opt.maxLongEdge !== undefined
        ? Number(opt.maxLongEdge)
        : null,
    jpegBackground: opt.jpegBackground || "#ffffff",
  };
}

/**
 * 核心队列管理器，解耦 Vue 响应式与底层异步任务流
 */
export function createCompressionQueue(options?: CompressionQueueOptions) {
  const workerClient = options?.workerClient ?? new WorkerClient();
  const maxFileBytes = options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxPixels = options?.maxPixels ?? (
    typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
      ? DEFAULT_MAX_PIXELS_MOBILE : DEFAULT_MAX_PIXELS_DESKTOP
  );

  const globalOptions = ref<CompressionOptions>({
    output: "keep",
    quality: 80,
    maxLongEdge: null,
    jpegBackground: "#ffffff",
    ...(options?.defaultOptions || {}),
  });

  const tasks = ref<QueueItem[]>([]) as Ref<QueueItem[]>;
  let activeRun: symbol | null = null;
  let validationEpoch = 0;
  const admissionError = ref<"BATCH_LIMIT" | null>(null);

  const isProcessing = computed<boolean>(() => {
    return tasks.value.some((t) => t.status === "processing");
  });

  const stats = computed<QueueStats>(() => {
    let totalOriginal = 0;
    let totalResult = 0;
    let completedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let processingCount = 0;
    let queuedCount = 0;

    for (const task of tasks.value) {
      switch (task.status) {
        case "processing":
          processingCount++;
          break;
        case "queued":
          queuedCount++;
          break;
        case "failed":
          failedCount++;
          break;
        case "cancelled":
          cancelledCount++;
          break;
        case "skipped":
          skippedCount++;
          completedCount++;
          totalOriginal += task.originalBytes;
          totalResult += task.result?.resultBytes ?? task.originalBytes;
          break;
        case "success":
          successCount++;
          completedCount++;
          totalOriginal += task.originalBytes;
          totalResult += task.result?.resultBytes ?? task.originalBytes;
          break;
      }
    }

    const totalSaved = totalOriginal - totalResult;
    const overallPercent =
      totalOriginal > 0 ? (totalSaved / totalOriginal) * 100 : 0;

    return {
      total: tasks.value.length,
      queued: queuedCount,
      processing: processingCount,
      completed: completedCount,
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
      cancelled: cancelledCount,
      totalOriginalBytes: totalOriginal,
      totalResultBytes: totalResult,
      totalSavedBytes: totalSaved,
      overallSavingsPercent: overallPercent,
    };
  });

  /**
   * 触发下一个排队任务
   */
  const scheduleNext = async (): Promise<void> => {
    // 互斥保护：已有调度正在执行或底层 Worker 忙碌时直接退出，等待当前任务完成事件触发
    if (activeRun || workerClient.isBusy()) return;

    const nextTask = tasks.value.find((t) => t.status === "queued");
    if (!nextTask) return;

    const run = Symbol("compression");
    activeRun = run;
    const isCurrent = () => activeRun === run && nextTask.status === "processing" && tasks.value.includes(nextTask);

    try {
      nextTask.status = "processing";
      nextTask.progressPhase = "decode";

      try {
        // 每次重新从 File 读取 ArrayBuffer，以支持重试并安全使用 Transferable
        const buffer = await nextTask.file.arrayBuffer();
        if (!isCurrent()) return;

        const result = await workerClient.process({
          taskId: nextTask.id,
          input: buffer,
          inputName: nextTask.originalName,
          mime: nextTask.detectedMime!,
          options: toPlainOptions(nextTask.optionsSnapshot),
          onProgress: (phase) => {
            if (isCurrent()) nextTask.progressPhase = phase;
          },
        });

        if (!isCurrent()) return;
        nextTask.result = result;
        if (typeof Blob !== "undefined" && typeof URL !== "undefined") {
          nextTask.resultBlob = new Blob([result.data], { type: result.mime });
          nextTask.resultUrl = URL.createObjectURL(nextTask.resultBlob);
        }

        if (result.unchanged) {
          nextTask.status = "skipped";
        } else {
          nextTask.status = "success";
        }
        nextTask.progressPhase = undefined;
      } catch (err: any) {
        if (!isCurrent()) return;
        nextTask.progressPhase = undefined;
        if (err instanceof WorkerTaskError) {
          if (err.code === "CANCELLED") {
            nextTask.status = "cancelled";
            nextTask.errorCode = "CANCELLED";
            nextTask.errorMessage = "任务已取消";
          } else {
            nextTask.status = "failed";
            nextTask.errorCode = err.code;
            nextTask.errorMessage = err.message;
          }
        } else {
          nextTask.status = "failed";
          nextTask.errorCode = "UNKNOWN";
          nextTask.errorMessage = err?.message || String(err);
        }
      }
    } finally {
      if (activeRun !== run) return;
      activeRun = null;
      // 当前任务结束（无论成功或失败），若还有排队任务，通过异步微延迟触发下一轮调度，斩断同步递归调用栈
      const hasMore = tasks.value.some((t) => t.status === "queued");
      if (hasMore) {
        setTimeout(scheduleNext, 0);
      }
    }
  };

  /**
   * 添加单个或批量图片进入任务列表与校验流程
   */
  const addFiles = async (files: File[] | FileList): Promise<void> => {
    const epoch = validationEpoch;
    admissionError.value = null;
    for (const file of Array.from(files)) {
      if (epoch !== validationEpoch) break;
      if (tasks.value.length >= MAX_BATCH_FILES) {
        admissionError.value = "BATCH_LIMIT";
        break;
      }
      // Reserve the slot before awaiting any file read, including concurrent uploads.
      tasks.value.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        file, originalName: file.name, originalBytes: file.size,
        status: "validating", optionsSnapshot: toPlainOptions(globalOptions.value),
      });
      const task = tasks.value[tasks.value.length - 1];
      const isCurrent = () => epoch === validationEpoch && tasks.value.includes(task) && task.status === "validating";
      const fail = (code: CompressionErrorCode) => { task.status = "failed"; task.errorCode = code; };
      if (file.size === 0) { fail("INVALID_FILE"); continue; }
      if (file.size > maxFileBytes) { fail("FILE_TOO_LARGE"); continue; }
      try {
        let buffer = await file.slice(0, 65536).arrayBuffer();
        if (!isCurrent()) continue;
        let format = detectImageFormat(buffer);
        if (!format) { fail("UNSUPPORTED_FORMAT"); continue; }
        let dims = probeDimensions(buffer);
        // APNG control chunks and JPEG frame headers can occur beyond the first 64 KiB.
        if ((format.mime === "image/png" && !format.isAnimated) || !dims) {
          buffer = await file.arrayBuffer();
          if (!isCurrent()) continue;
          format = detectImageFormat(buffer);
          dims = probeDimensions(buffer);
        }
        if (!format) { fail("INVALID_FILE"); continue; }
        if (format.isAnimated) { fail("ANIMATED_UNSUPPORTED"); continue; }
        if (!dims || dims.width <= 0 || dims.height <= 0) { fail("INVALID_FILE"); continue; }
        if (isPixelLimitExceeded(dims.width, dims.height, maxPixels)) { fail("PIXEL_LIMIT"); continue; }
        task.detectedMime = format.mime;
        task.originalWidth = dims.width;
        task.originalHeight = dims.height;
        task.previewUrl = URL.createObjectURL(file);
        task.status = "queued";
      } catch {
        if (isCurrent()) fail("INVALID_FILE");
      }
    }
    void scheduleNext();
  };

  /**
   * 取消某个任务
   */
  const cancelTask = (taskId: string): void => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === "queued" || task.status === "validating") {
      task.status = "cancelled";
      task.errorCode = "CANCELLED";
      task.errorMessage = "已取消";
      return;
    }

    if (task.status === "processing") {
      workerClient.cancelTask(taskId);
      activeRun = null;
      task.status = "cancelled";
      task.errorCode = "CANCELLED";
      task.errorMessage = "已取消";
      void scheduleNext();
    }
  };

  /**
   * 重试已失败或已取消的任务
   */
  const retryTask = (taskId: string): void => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task || task.status === "validating" || task.status === "queued" || task.status === "processing") {
      return;
    }

    // 若原本因文件校验失败（如格式不支持），则不可重试
    if (
      task.errorCode === "UNSUPPORTED_FORMAT" ||
      task.errorCode === "ANIMATED_UNSUPPORTED" ||
      task.errorCode === "INVALID_FILE" ||
      task.errorCode === "FILE_TOO_LARGE" ||
      task.errorCode === "PIXEL_LIMIT"
    ) {
      return;
    }

    // A file cancelled during validation has no verified MIME yet. Revalidate it.
    if (!task.detectedMime) {
      removeTask(taskId);
      void addFiles([task.file]);
      return;
    }

    // 释放之前的压缩结果
    if (task.resultUrl && typeof URL !== "undefined") {
      URL.revokeObjectURL(task.resultUrl);
    }
    task.resultUrl = undefined;
    task.resultBlob = undefined;
    task.result = undefined;
    task.errorCode = undefined;
    task.errorMessage = undefined;

    // 更新压缩选项为当前最新的全局配置
    task.optionsSnapshot = toPlainOptions(globalOptions.value);
    task.status = "queued";

    scheduleNext();
  };

  /**
   * 移除任务并释放内存资源
   */
  const removeTask = (taskId: string): void => {
    const index = tasks.value.findIndex((t) => t.id === taskId);
    if (index === -1) return;

    const task = tasks.value[index];

    if (task.status === "processing") {
      cancelTask(taskId);
    }

    if (typeof URL !== "undefined") {
      if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
      if (task.resultUrl) URL.revokeObjectURL(task.resultUrl);
    }

    tasks.value.splice(index, 1);
  };

  /**
   * 清空所有任务并释放所有 ObjectURL 内存
   */
  const clearAll = (): void => {
    validationEpoch++;
    activeRun = null;
    admissionError.value = null;
    for (const task of tasks.value) {
      if (task.status === "processing") {
        workerClient.cancelTask(task.id);
      }
      if (typeof URL !== "undefined") {
        if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
        if (task.resultUrl) URL.revokeObjectURL(task.resultUrl);
      }
    }
    tasks.value = [];
  };

  /**
   * 将当前列表中所有支持的文件按最新全局配置重新排队并压缩
   */
  const recompressAll = (): void => {
    // 若当前正在处理，强杀当前运行的 Worker 任务并重置调度互斥锁
    if (workerClient.isBusy()) {
      workerClient.terminate();
    }
    activeRun = null;

    let hasRecompressed = false;
    const needsValidation: string[] = [];
    for (const task of tasks.value) {
      if (task.status === "validating") continue;
      // 永久性格式或大小超限错误不可重试，予以跳过
      if (
        task.errorCode === "UNSUPPORTED_FORMAT" ||
        task.errorCode === "ANIMATED_UNSUPPORTED" ||
        task.errorCode === "INVALID_FILE" ||
        task.errorCode === "FILE_TOO_LARGE" ||
        task.errorCode === "PIXEL_LIMIT"
      ) {
        continue;
      }

      if (!task.detectedMime) { needsValidation.push(task.id); continue; }

      // 释放旧的压缩结果 URL 与状态
      if (task.resultUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(task.resultUrl);
      }
      task.resultUrl = undefined;
      task.resultBlob = undefined;
      task.result = undefined;
      task.errorCode = undefined;
      task.errorMessage = undefined;
      task.progressPhase = undefined;

      // 提取最新全局 options 快照并还原为纯对象
      task.optionsSnapshot = toPlainOptions(globalOptions.value);
      task.status = "queued";
      hasRecompressed = true;
    }

    for (const id of needsValidation) retryTask(id);
    if (hasRecompressed) {
      scheduleNext();
    }
  };

  /**
   * 销毁队列与底层的 Worker 线程
   */
  const destroy = (): void => {
    clearAll();
    workerClient.terminate();
  };

  return {
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
    destroy,
  };
}

export type CompressionQueue = ReturnType<typeof createCompressionQueue>;

let sharedClientQueue: CompressionQueue | null = null;

/**
 * Nuxt 客户端 Composable
 * 默认使用共享单例，保证多语言路由切换（/、/en/、/ja/）时不丢失现有任务状态；
 * 若显式提供 options（如测试隔离或独立调度），则创建新独立队列。
 */
export function useCompressionQueue(options?: CompressionQueueOptions): CompressionQueue {
  if (options) {
    return createCompressionQueue(options);
  }
  if (!sharedClientQueue) {
    sharedClientQueue = createCompressionQueue();
  }
  return sharedClientQueue;
}
