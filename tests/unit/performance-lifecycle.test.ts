import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompressionQueue } from "../../composables/useCompressionQueue.client";
import { WorkerClient, WorkerTaskError } from "../../lib/image/workerClient";
import { downloadTasksAsZip, DEFAULT_MAX_ZIP_BYTES } from "../../lib/image/download";
import type { QueueItem } from "../../composables/useCompressionQueue.client";

describe("T03-02 性能调优、资源生命周期与超限保护", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis.URL, "createObjectURL").mockImplementation(() => "blob:mock-preview");
    vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
  });

  describe("超限保护与前置快速失败", () => {
    it("文件体积超过 30MB 时必须立即拦截，绝不分发给 Worker 浪费内存与算力", async () => {
      const queue = createCompressionQueue();
      const hugeFile = new File([new ArrayBuffer(10)], "huge.jpg", { type: "image/jpeg" });
      Object.defineProperty(hugeFile, "size", { value: 31 * 1024 * 1024 });

      await queue.addFiles([hugeFile]);
      expect(queue.tasks.value.length).toBe(1);
      expect(queue.tasks.value[0].status).toBe("failed");
      expect(queue.tasks.value[0].errorCode).toBe("FILE_TOO_LARGE");
    });

    it("空文件 (0 字节) 必须立即拦截", async () => {
      const queue = createCompressionQueue();
      const emptyFile = new File([], "empty.png", { type: "image/png" });

      await queue.addFiles([emptyFile]);
      expect(queue.tasks.value.length).toBe(1);
      expect(queue.tasks.value[0].status).toBe("failed");
      expect(queue.tasks.value[0].errorCode).toBe("INVALID_FILE");
    });

    it("ZIP 打包超过安全保护上限 (100MB) 时拒绝打包并抛出友好错误", async () => {
      const mockTasks: QueueItem[] = [
        {
          id: "huge-task",
          file: new File([new ArrayBuffer(10)], "photo.jpg"),
          originalName: "photo.jpg",
          originalBytes: DEFAULT_MAX_ZIP_BYTES + 1,
          status: "success",
          optionsSnapshot: { output: "keep", quality: 80, maxLongEdge: null, jpegBackground: "#ffffff" },
          resultBlob: new Blob([new ArrayBuffer(10)]),
          result: {
            id: "huge-task",
            originalName: "photo.jpg",
            originalBytes: DEFAULT_MAX_ZIP_BYTES + 1,
            resultBytes: DEFAULT_MAX_ZIP_BYTES + 1,
            mime: "image/jpeg",
            extension: "jpg",
            width: 100,
            height: 100,
            elapsedMs: 10,
            mode: "lossy",
            unchanged: false,
            data: new ArrayBuffer(10),
          },
        },
      ];

      await expect(downloadTasksAsZip(mockTasks)).rejects.toThrow(/ZIP safety limit/i);
    });
  });

  describe("资源回收与内存泄漏排查", () => {
    it("执行 clearAll 时必须成对调用 revokeObjectURL 清空所有 previewUrl 与 resultUrl", async () => {
      const queue = createCompressionQueue();
      const file1 = new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], "f1.png", {
        type: "image/png",
      });
      const file2 = new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], "f2.png", {
        type: "image/png",
      });

      await queue.addFiles([file1, file2]);

      expect(queue.tasks.value.length).toBe(2);
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(2);

      queue.clearAll();

      expect(queue.tasks.value.length).toBe(0);
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it("队列 destroy 时完全终止底层 Worker 并清理定时器", () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const workerClient = new WorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      });
      const terminateSpy = vi.spyOn(workerClient, "terminate");

      const queue = createCompressionQueue({ workerClient });
      queue.destroy();

      expect(terminateSpy).toHaveBeenCalled();
      expect(queue.tasks.value.length).toBe(0);
    });
  });
});
