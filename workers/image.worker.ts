import type { WorkerRequest, WorkerResponse, CompressionErrorCode } from "../lib/image/types";
import { processImage } from "../lib/image/codec";

/**
 * Tiny Image - Web Worker 核心处理线程
 * 运行在独立的浏览器后台线程中，处理 WASM 编解码、像素双线性插值缩放与透明通道填充
 */

// 告知主线程 Worker 启动完成
self.postMessage({ type: "READY" } satisfies WorkerResponse);

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req) return;

  if (req.type === "PING") {
    self.postMessage({ type: "PONG" } satisfies WorkerResponse);
    return;
  }

  if (req.type === "PROCESS") {
    const { taskId, input, inputName, mime, options } = req;

    try {
      const result = await processImage({
        id: taskId,
        originalName: inputName,
        inputBuffer: input,
        inputMime: mime,
        options,
        onProgress: (phase) => {
          self.postMessage({
            type: "PROGRESS",
            taskId,
            phase,
          } satisfies WorkerResponse);
        },
      });

      // 通过 Transferable 转移 ArrayBuffer 所有权，杜绝二次内存拷贝
      self.postMessage(
        {
          type: "SUCCESS",
          taskId,
          result,
        } satisfies WorkerResponse,
        [result.data],
      );
    } catch (err: any) {
      let code: CompressionErrorCode = "ENCODE_FAILED";
      const message = err?.message || String(err);

      if (message.includes("pixel") || message.includes("PIXEL_LIMIT")) {
        code = "PIXEL_LIMIT";
      } else if (
        message.includes("decode") ||
        message.includes("Corrupt") ||
        message.includes("Failed to parse") ||
        message.includes("Invalid")
      ) {
        code = "DECODE_FAILED";
      } else if (message.includes("wasm") || message.includes("WASM") || message.includes("fetch")) {
        code = "WASM_LOAD_FAILED";
      } else if (message.includes("memory") || message.includes("Out of memory")) {
        code = "OUT_OF_MEMORY";
      }

      self.postMessage({
        type: "ERROR",
        taskId,
        code,
        message,
      } satisfies WorkerResponse);
    }
  }
});
