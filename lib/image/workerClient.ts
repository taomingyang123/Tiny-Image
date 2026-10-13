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
        this.activeReject = null;
        this.currentTaskId = null;
      };

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
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
          reject(new WorkerTaskError(msg.code, msg.message));
        }
      };

      const handleError = (errorEvent: ErrorEvent) => {
        cleanupListeners();
        // Worker 崩溃时终止并重置
        this.worker?.terminate();
        this.worker = null;
        reject(
          new WorkerTaskError(
            "UNKNOWN",
            errorEvent.message || "Unknown worker error",
          ),
        );
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      // 发送请求，通过 Transferable 转移 input 避免双倍内存
      const request: WorkerRequest = {
        type: "PROCESS",
        taskId,
        input,
        inputName,
        mime,
        options,
      };

      worker.postMessage(request, [input]);
    });
  }
}
