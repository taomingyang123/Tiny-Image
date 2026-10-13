import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompressionQueue } from "../../composables/useCompressionQueue.client";
import { WorkerClient, WorkerTaskError } from "../../lib/image/workerClient";
import type { CompressionResult, WorkerResponse, WorkerRequest } from "../../lib/image/types";

// 辅助函数：构造测试用的 File 对象
function createMockFile(
  bytes: Uint8Array | number[],
  name: string,
  type = "image/png",
): File {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new File([u8.buffer as ArrayBuffer], name, { type });
}

// 合法 1x1 静态 PNG
const VALID_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// 包含 acTL 的 APNG 动图头
const APNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x08,
  0x61, 0x63, 0x54, 0x4c, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
]);

// 模拟 Worker 工厂，用于精确测试超时与 Worker 协议
class MockWorker {
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
      // 模拟异步返回
      setTimeout(() => {
        if (this.terminated) return;

        // 模拟进度
        this.dispatchMessage({
          type: "PROGRESS",
          taskId: req.taskId,
          phase: "decode",
        });

        // 模拟成功
        const mockResult: CompressionResult = {
          id: req.taskId,
          originalName: req.inputName,
          originalBytes: req.input.byteLength,
          resultBytes: Math.floor(req.input.byteLength * 0.8),
          mime: "image/png",
          extension: "png",
          width: 1,
          height: 1,
          elapsedMs: 15,
          mode: "lossless",
          unchanged: false,
          data: new ArrayBuffer(10),
        };

        this.dispatchMessage({
          type: "SUCCESS",
          taskId: req.taskId,
          result: mockResult,
        });
      }, 10);
    }
  }

  dispatchMessage(res: WorkerResponse) {
    const handlers = this.listeners["message"] || [];
    for (const h of handlers) {
      h({ data: res });
    }
  }

  terminate() {
    this.terminated = true;
  }
}

describe("WorkerClient 核心机制", () => {
  it("应成功发送 PROCESS 并接收 PROGRESS 和 SUCCESS", async () => {
    let mockWorkerInstance: MockWorker | null = null;
    const client = new WorkerClient({
      workerFactory: () => {
        mockWorkerInstance = new MockWorker();
        return mockWorkerInstance as unknown as Worker;
      },
    });

    const progressPhases: string[] = [];
    const dummyBuffer = new ArrayBuffer(100);

    const result = await client.process({
      taskId: "t1",
      input: dummyBuffer,
      inputName: "test.png",
      mime: "image/png",
      options: {
        output: "keep",
        quality: 80,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
      onProgress: (p) => progressPhases.push(p),
    });

    expect(result.id).toBe("t1");
    expect(result.resultBytes).toBe(80);
    expect(progressPhases).toContain("decode");
    expect(client.isBusy()).toBe(false);
  });

  it("当任务执行超过限制时应触发 TIMEOUT 强杀 Worker 并抛出异常", async () => {
    class HangingWorker extends MockWorker {
      override postMessage() {
        // 不回包，模拟死锁或重度卡死
      }
    }

    let hangingInstance: HangingWorker | null = null;
    const client = new WorkerClient({
      workerFactory: () => {
        hangingInstance = new HangingWorker();
        return hangingInstance as unknown as Worker;
      },
      defaultTimeoutMs: 30, // 30ms 极短超时
    });

    const dummyBuffer = new ArrayBuffer(50);
    let capturedError: any = null;

    try {
      await client.process({
        taskId: "timeout_task",
        input: dummyBuffer,
        inputName: "timeout.png",
        mime: "image/png",
        options: {
          output: "keep",
          quality: 80,
          maxLongEdge: null,
          jpegBackground: "#ffffff",
        },
        timeoutMs: 30,
      });
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).toBeInstanceOf(WorkerTaskError);
    expect(capturedError.code).toBe("TIMEOUT");
    expect(hangingInstance!.terminated).toBe(true);
    expect(client.isBusy()).toBe(false);
  });

  it("当调用 cancelTask 时应强杀 Worker 并触发 CANCELLED", async () => {
    class SlowWorker extends MockWorker {
      override postMessage() {
        // 慢速 Worker
      }
    }

    let slowInstance: SlowWorker | null = null;
    const client = new WorkerClient({
      workerFactory: () => {
        slowInstance = new SlowWorker();
        return slowInstance as unknown as Worker;
      },
    });

    const dummyBuffer = new ArrayBuffer(50);
    const promise = client.process({
      taskId: "cancel_me",
      input: dummyBuffer,
      inputName: "cancel.png",
      mime: "image/png",
      options: {
        output: "keep",
        quality: 80,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
    });

    expect(client.isBusy()).toBe(true);
    const cancelled = client.cancelTask("cancel_me");
    expect(cancelled).toBe(true);

    let capturedError: any = null;
    try {
      await promise;
    } catch (err) {
      capturedError = err;
    }

    expect(capturedError).toBeInstanceOf(WorkerTaskError);
    expect(capturedError.code).toBe("CANCELLED");
    expect(slowInstance!.terminated).toBe(true);
    expect(client.isBusy()).toBe(false);
  });
});

describe("createCompressionQueue 队列校验与生命周期", () => {
  beforeEach(() => {
    // 模拟 URL.createObjectURL 和 URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn((_blob: any) => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("应准确拦截空文件 (0 字节) 为 INVALID_FILE", async () => {
    const queue = createCompressionQueue();
    const emptyFile = createMockFile([], "empty.png");

    await queue.addFiles([emptyFile]);

    expect(queue.tasks.value.length).toBe(1);
    const task = queue.tasks.value[0];
    expect(task.status).toBe("failed");
    expect(task.errorCode).toBe("INVALID_FILE");
  });

  it("应拦截超过单张文件大小上限的文件为 FILE_TOO_LARGE", async () => {
    const queue = createCompressionQueue({
      maxFileBytes: 10, // 限制为 10 字节
    });
    const largeFile = createMockFile(new Uint8Array(20), "large.png");

    await queue.addFiles([largeFile]);

    expect(queue.tasks.value.length).toBe(1);
    const task = queue.tasks.value[0];
    expect(task.status).toBe("failed");
    expect(task.errorCode).toBe("FILE_TOO_LARGE");
  });

  it("应拦截不支持的文件内容格式为 UNSUPPORTED_FORMAT", async () => {
    const queue = createCompressionQueue();
    const fakeFile = createMockFile(
      [0x54, 0x45, 0x53, 0x54], // "TEST"
      "fake.jpg",
    );

    await queue.addFiles([fakeFile]);

    expect(queue.tasks.value.length).toBe(1);
    const task = queue.tasks.value[0];
    expect(task.status).toBe("failed");
    expect(task.errorCode).toBe("UNSUPPORTED_FORMAT");
  });

  it("应拦截动图 APNG 为 ANIMATED_UNSUPPORTED", async () => {
    const queue = createCompressionQueue();
    const apngFile = createMockFile(APNG_BYTES, "animation.png");

    await queue.addFiles([apngFile]);

    expect(queue.tasks.value.length).toBe(1);
    const task = queue.tasks.value[0];
    expect(task.status).toBe("failed");
    expect(task.errorCode).toBe("ANIMATED_UNSUPPORTED");
  });

  it("合法文件应成功加入队列，执行并更新统计信息", async () => {
    const mockWorkerClient = new WorkerClient({
      workerFactory: () => new MockWorker() as unknown as Worker,
    });
    const queue = createCompressionQueue({ workerClient: mockWorkerClient });

    const validFile = createMockFile(VALID_1X1_PNG, "valid.png");
    await queue.addFiles([validFile]);

    expect(queue.tasks.value.length).toBe(1);
    // 等待异步队列执行完成
    await new Promise((resolve) => setTimeout(resolve, 50));

    const task = queue.tasks.value[0];
    expect(task.status).toBe("success");
    expect(task.result).toBeDefined();
    expect(task.result?.resultBytes).toBeLessThan(VALID_1X1_PNG.byteLength);

    const stats = queue.stats.value;
    expect(stats.total).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.success).toBe(1);
    expect(stats.totalSavedBytes).toBeGreaterThan(0);
  });

  it("支持移除任务并正确 revokeObjectURL 释放内存", async () => {
    const queue = createCompressionQueue();
    const file = createMockFile(VALID_1X1_PNG, "test.png");
    await queue.addFiles([file]);

    const taskId = queue.tasks.value[0].id;
    queue.removeTask(taskId);

    expect(queue.tasks.value.length).toBe(0);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
