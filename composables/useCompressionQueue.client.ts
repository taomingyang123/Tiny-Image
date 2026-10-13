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
 * 核心队列管理器，解耦 Vue 响应式与底层异步任务流
 */
export function createCompressionQueue(options?: CompressionQueueOptions) {
  const workerClient = options?.workerClient ?? new WorkerClient();
  const maxFileBytes = options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxPixels = options?.maxPixels ?? DEFAULT_MAX_PIXELS_DESKTOP;

  const globalOptions = ref<CompressionOptions>({
    output: "keep",
    quality: 80,
    maxLongEdge: null,
    jpegBackground: "#ffffff",
    ...(options?.defaultOptions || {}),
  });

  const tasks = ref<QueueItem[]>([]) as Ref<QueueItem[]>;
  let isScheduling = false;

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

    const totalSaved = Math.max(0, totalOriginal - totalResult);
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
    if (isScheduling) return;
    isScheduling = true;

    try {
      if (workerClient.isBusy()) return;

      const nextTask = tasks.value.find((t) => t.status === "queued");
      if (!nextTask) return;

      nextTask.status = "processing";
      nextTask.progressPhase = "decode";

      try {
        // 每次重新从 File 读取 ArrayBuffer，以支持重试并安全使用 Transferable
        const buffer = await nextTask.file.arrayBuffer();

        const result = await workerClient.process({
          taskId: nextTask.id,
          input: buffer,
          inputName: nextTask.originalName,
          mime: nextTask.detectedMime!,
          options: nextTask.optionsSnapshot,
          onProgress: (phase) => {
            nextTask.progressPhase = phase;
          },
        });

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
      isScheduling = false;
      // 若还有队列等待中的任务，继续递归处理
      const hasMore = tasks.value.some((t) => t.status === "queued");
      if (hasMore) {
        scheduleNext();
      }
    }
  };

  /**
   * 添加单个或批量图片进入任务列表与校验流程
   */
  const addFiles = async (files: File[] | FileList): Promise<void> => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    for (const file of fileList) {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 1. 0-byte 检查
      if (file.size === 0) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: 0,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "INVALID_FILE",
          errorMessage: "文件大小为 0 字节，无法解析",
        });
        continue;
      }

      // 2. 超限文件大小检查
      if (file.size > maxFileBytes) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: file.size,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "FILE_TOO_LARGE",
          errorMessage: "文件大小超过单张上限（30 MiB）",
        });
        continue;
      }

      // 3. 读取头部前 64 KiB 进行魔数识别与尺寸探测
      const headerSlice = file.slice(0, 65536);
      let headerBuffer: ArrayBuffer;
      try {
        headerBuffer = await headerSlice.arrayBuffer();
      } catch (err: any) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: file.size,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "INVALID_FILE",
          errorMessage: "无法读取文件数据",
        });
        continue;
      }

      const format = detectImageFormat(headerBuffer);
      if (!format) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: file.size,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "UNSUPPORTED_FORMAT",
          errorMessage: "暂不支持此格式，请选择 JPG、PNG 或 WebP 图片",
        });
        continue;
      }

      if (format.isAnimated) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: file.size,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "ANIMATED_UNSUPPORTED",
          errorMessage: "当前版本暂不支持动图压缩",
        });
        continue;
      }

      // 4. 尺寸与像素安全预检
      const dims = probeDimensions(headerBuffer);
      if (dims && isPixelLimitExceeded(dims.width, dims.height, maxPixels)) {
        tasks.value.push({
          id: taskId,
          file,
          originalName: file.name,
          originalBytes: file.size,
          status: "failed",
          optionsSnapshot: { ...globalOptions.value },
          errorCode: "PIXEL_LIMIT",
          errorMessage: `图片像素过大 (${dims.width}x${dims.height})，已超过安全保护上限`,
        });
        continue;
      }

      // 创建预览 ObjectURL
      let previewUrl: string | undefined;
      if (typeof URL !== "undefined") {
        previewUrl = URL.createObjectURL(file);
      }

      // 校验全部通过，加入队列排队
      tasks.value.push({
        id: taskId,
        file,
        originalName: file.name,
        originalBytes: file.size,
        status: "queued",
        optionsSnapshot: { ...globalOptions.value },
        detectedMime: format.mime,
        originalWidth: dims?.width,
        originalHeight: dims?.height,
        previewUrl,
      });
    }

    // 触发调度
    scheduleNext();
  };

  /**
   * 取消某个任务
   */
  const cancelTask = (taskId: string): void => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === "queued") {
      task.status = "cancelled";
      task.errorCode = "CANCELLED";
      task.errorMessage = "已取消";
      return;
    }

    if (task.status === "processing") {
      workerClient.cancelTask(taskId);
      task.status = "cancelled";
      task.errorCode = "CANCELLED";
      task.errorMessage = "已取消";
    }
  };

  /**
   * 重试已失败或已取消的任务
   */
  const retryTask = (taskId: string): void => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task || task.status === "queued" || task.status === "processing") {
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
    task.optionsSnapshot = { ...globalOptions.value };
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
      workerClient.cancelTask(taskId);
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
   * 销毁队列与底层的 Worker 线程
   */
  const destroy = (): void => {
    clearAll();
    workerClient.terminate();
  };

  return {
    tasks,
    globalOptions,
    isProcessing,
    stats,
    addFiles,
    cancelTask,
    retryTask,
    removeTask,
    clearAll,
    destroy,
  };
}

export type CompressionQueue = ReturnType<typeof createCompressionQueue>;

/**
 * Nuxt 客户端 Composable
 */
export function useCompressionQueue(options?: CompressionQueueOptions) {
  return createCompressionQueue(options);
}
