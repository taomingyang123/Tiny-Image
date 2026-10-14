import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompressionQueue } from "../../composables/useCompressionQueue.client";
import { downloadTasksAsZip } from "../../lib/image/download";
import { WorkerClient } from "../../lib/image/workerClient";
import type { WorkerRequest } from "../../lib/image/types";

// 构造测试图片
function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes).buffer], name, { type });
}

// 1x1 PNG
const PNG_BYTES = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

// 最小 JPEG
const JPEG_BYTES = [
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
];

class MockE2EWorker {
  listeners: Record<string, Function[]> = {};
  terminated = false;

  addEventListener(type: string, listener: Function) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  postMessage(data: any, _transfer?: any[]) {
    if (this.terminated) return;
    const req = data as WorkerRequest;

    if (req.type === "PROCESS") {
      setTimeout(() => {
        if (this.terminated) return;
        const inputLen = req.input.byteLength;
        const fakeOutput = new Uint8Array(Math.max(10, Math.floor(inputLen * 0.7)));
        this.dispatchMessage({
          type: "SUCCESS",
          taskId: req.taskId,
          result: {
            id: req.taskId,
            originalName: req.inputName,
            originalBytes: inputLen,
            resultBytes: fakeOutput.byteLength,
            mime: req.options.output === "jpeg" ? "image/jpeg" : "image/webp",
            extension: req.options.output === "jpeg" ? "jpg" : "webp",
            width: 1,
            height: 1,
            elapsedMs: 42,
            mode: "lossy",
            unchanged: false,
            data: fakeOutput.buffer,
          },
        });
      }, 10);
    }
  }

  terminate() {
    this.terminated = true;
    this.listeners = {};
  }

  dispatchMessage(data: any) {
    const list = this.listeners["message"] || [];
    for (const fn of list) {
      fn({ data });
    }
  }
}

describe("端到端多图片批量上传与压缩下载工作流", () => {
  let mockWorker: MockE2EWorker;
  let workerClient: WorkerClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockWorker = new MockE2EWorker();
    workerClient = new WorkerClient({
      workerFactory: () => mockWorker as unknown as Worker,
      defaultTimeoutMs: 2000,
    });

    vi.spyOn(globalThis.URL, "createObjectURL").mockImplementation(() => "blob:mock-url");
    vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("批量处理 PNG 与 JPEG 文件，校验状态流转与最终 ZIP 归档", async () => {
    const queue = createCompressionQueue({ workerClient });
    queue.globalOptions.value.output = "webp"; // 统一转为 webp

    const file1 = makeFile(PNG_BYTES, "photo1.png", "image/png");
    const file2 = makeFile(JPEG_BYTES, "photo2.jpg", "image/jpeg");

    await queue.addFiles([file1, file2]);

    expect(queue.tasks.value.length).toBe(2);

    // 等待异步队列完成
    await vi.waitFor(() => {
      expect(queue.stats.value.completed).toBe(2);
    }, { timeout: 3000 });

    const [t1, t2] = queue.tasks.value;
    expect(t1.status).toBe("success");
    expect(t2.status).toBe("success");
    expect(t1.result?.extension).toBe("webp");
    expect(t2.result?.extension).toBe("webp");

    // 验证统计数据
    expect(queue.stats.value.total).toBe(2);
    expect(queue.stats.value.success).toBe(2);
    expect(queue.stats.value.totalSavedBytes).toBeGreaterThan(0);
    expect(queue.stats.value.overallSavingsPercent).toBeGreaterThan(0);

    // 验证 ZIP 批量导出及调用无异常
    await expect(downloadTasksAsZip(queue.tasks.value, "batch-images.zip")).resolves.toBeUndefined();
  });
});
