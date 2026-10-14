import type {
  CompressionOptions,
  CompressionResult,
  CompressionErrorCode,
  SupportedInput,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export class WorkerTaskError extends Error {
  readonly code: CompressionErrorCode;

  constructor(code: CompressionErrorCode, message: string) {
    super(message);
    this.name = "WorkerTaskError";
    this.code = code;
  }
}

export interface WorkerProcessParams {
  taskId: string;
  input: ArrayBuffer;
  inputName: string;
  mime: SupportedInput;
  options: CompressionOptions;
  onProgress?: (phase: "decode" | "resize" | "encode" | "finalize") => void;
  timeoutMs?: number;
}

export interface WorkerClientOptions {
  workerFactory?: () => Worker;
  defaultTimeoutMs?: number;
}

export class WorkerClient {
  private worker: Worker | null = null;
  private workerFactory: () => Worker;
  private defaultTimeoutMs: number;
  private currentTaskId: string | null = null;
  private activeCleanup: (() => void) | null = null;
  private activeReject: ((reason?: any) => void) | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: WorkerClientOptions) {
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 60_000;
    this.workerFactory =
      options?.workerFactory ??
      (() => {
        return new Worker(
          new URL("../../workers/image.worker.ts", import.meta.url),
          { type: "module" },
        );
      });
  }

  /**
   * 确保 Worker 实例存在，若不存在或已被强杀则重新创建
   */
  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.addEventListener("message", (e) => {
        if (e.data?.type === "READY") {
        }
      });
      this.worker.addEventListener("error", (err) => {
        console.error("[Tiny Image WorkerClient] Global worker onerror:", err.message, err);
      });
    }
    return this.worker;
  }

  /**
   * 清除当前任务的超时计时器
   */
  private clearTimeoutTimer(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * 强制终止当前 Worker 线程并清理状态
   */
  public terminate(reasonCode: CompressionErrorCode = "CANCELLED", message = "Worker terminated"): void {
    this.clearTimeoutTimer();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.activeReject && this.currentTaskId) {
      const reject = this.activeReject;
      this.activeCleanup?.();
      this.activeReject = null;
      this.currentTaskId = null;
      reject(new WorkerTaskError(reasonCode, message));
    } else {
      this.activeReject = null;
      this.currentTaskId = null;
    }
  }

  /**
   * 取消指定的运行中任务
   */
  public cancelTask(taskId: string): boolean {
    if (this.currentTaskId === taskId) {
      this.terminate("CANCELLED", `Task ${taskId} was cancelled by user`);
      return true;
    }
    return false;
  }

  /**
   * 检查当前是否有任务正在 Worker 中执行
   */
  public isBusy(): boolean {
    return this.currentTaskId !== null;
  }

  /**
   * 提交压缩任务到 Worker 运行
   */
  public async process(params: WorkerProcessParams): Promise<CompressionResult> {
    if (this.isBusy()) {
      throw new WorkerTaskError(
        "UNKNOWN",
        `Worker is already busy processing task ${this.currentTaskId}`,
      );
    }

    const {
      taskId,
      input,
      inputName,
      mime,
      options,
      onProgress,
      timeoutMs = this.defaultTimeoutMs,
    } = params;

    if (typeof Worker === "undefined" && typeof window !== "undefined" && !this.worker) {
      throw new WorkerTaskError("UNSUPPORTED_BROWSER", "Web Workers are unavailable");
    }
    const worker = this.getOrCreateWorker();
    this.currentTaskId = taskId;


    return new Promise<CompressionResult>((resolve, reject) => {
      this.activeReject = reject;

      // 设置超时强杀保护
      this.timeoutTimer = setTimeout(() => {
        this.terminate(
          "TIMEOUT",
          `Task ${taskId} timed out after ${timeoutMs}ms`,
        );
      }, timeoutMs);

      const cleanupListeners = () => {
        this.clearTimeoutTimer();
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        this.activeCleanup = null;
        this.activeReject = null;
        this.currentTaskId = null;
      };

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (this.worker !== worker || this.currentTaskId !== taskId) return;
        const msg = event.data;
        if (!msg) return;

        if (msg.type === "PROGRESS" && msg.taskId === taskId) {
          onProgress?.(msg.phase);
          return;
        }

        if (msg.type === "SUCCESS" && msg.taskId === taskId) {
          cleanupListeners();
          resolve(msg.result);
          return;
        }

        if (msg.type === "ERROR" && msg.taskId === taskId) {
          cleanupListeners();
          if (msg.code === "WASM_LOAD_FAILED" || msg.code === "OUT_OF_MEMORY") {
            worker.terminate();
            this.worker = null;
          }
          reject(new WorkerTaskError(msg.code, msg.message));
        }
      };

      const handleError = (errorEvent: ErrorEvent) => {
        console.error("[Tiny Image workerClient onerror]:", errorEvent.message, errorEvent.error || errorEvent);
        cleanupListeners();
        // Worker 崩溃时终止并重置
        this.worker?.terminate();
        this.worker = null;
        const msg = errorEvent.message || (errorEvent.error ? String(errorEvent.error) : "Worker execution error");
        reject(
          new WorkerTaskError(
            "UNKNOWN",
            msg,
          ),
        );
      };

      this.activeCleanup = cleanupListeners;
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      // 深度纯化 options 为原生 Plain Object，杜绝 Vue Proxy 导致 postMessage 触发 DataCloneError
      const safeOptions: CompressionOptions = {
        output: options.output,
        quality: Number(options.quality),
        maxLongEdge:
          options.maxLongEdge !== null && options.maxLongEdge !== undefined
            ? Number(options.maxLongEdge)
            : null,
        jpegBackground: options.jpegBackground || "#ffffff",
      };

      // 发送请求，通过 Transferable 转移 input 避免双倍内存
      const request: WorkerRequest = {
        type: "PROCESS",
        taskId: String(taskId),
        input,
        inputName: String(inputName),
        mime,
        options: safeOptions,
      };

      try {
        worker.postMessage(request, [input]);
      } catch (postErr: any) {
        console.error("[Tiny Image WorkerClient] postMessage failed:", postErr);
        cleanupListeners();
        reject(
          new WorkerTaskError(
            "UNKNOWN",
            `Failed to dispatch task to worker: ${postErr?.message || postErr}`,
          ),
        );
      }
    });
  }
}
