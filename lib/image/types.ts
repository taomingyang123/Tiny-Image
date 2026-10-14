/**
 * Tiny Image (tinystool-image-tools) - 数据契约定义
 * 依据 docs/03-CONTRACTS.md 规范
 */

export type SupportedInput = 'image/jpeg' | 'image/png' | 'image/webp';
export type SupportedOutput = SupportedInput;
export type OutputMode = 'keep' | 'jpeg' | 'png' | 'webp';

export interface CompressionOptions {
  /** 输出目标格式：保持原格式、转 JPEG、转 PNG、转 WebP */
  output: OutputMode;
  /** 整数 1..100；JPEG 有损编码或 PNG 智能色彩量化生效 */
  quality: number;
  /** 最长边限制：null 为不改变原图尺寸；1..10000 为有效像素 */
  maxLongEdge: number | null;
  /** JPEG 输出透明图时背景填充颜色，v1 固定白色 */
  jpegBackground: '#ffffff';
}

export type CompressionStatus =
  | 'idle'
  | 'validating'
  | 'queued'
  | 'processing'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'cancelled';

export type CompressionErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'ANIMATED_UNSUPPORTED'
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'PIXEL_LIMIT'
  | 'DECODE_FAILED'
  | 'ENCODE_FAILED'
  | 'WASM_LOAD_FAILED'
  | 'UNSUPPORTED_BROWSER'
  | 'OUT_OF_MEMORY'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'ZIP_TOO_LARGE'
  | 'UNKNOWN';

export interface CompressionResult {
  id: string;
  originalName: string;
  originalBytes: number;
  resultBytes: number;
  mime: SupportedOutput;
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  elapsedMs: number;
  mode: 'lossy' | 'lossless';
  /** PNG 无损结果未比原图更小时为 true */
  unchanged: boolean;
  /** 编码二进制数据，主线程据此构建 Blob */
  data: ArrayBuffer;
}

export interface CompressionTask {
  id: string;
  file: File;
  originalName: string;
  originalBytes: number;
  status: CompressionStatus;
  optionsSnapshot: CompressionOptions;
  result?: CompressionResult;
  errorCode?: CompressionErrorCode;
  errorMessage?: string;
  progressPhase?: 'decode' | 'resize' | 'encode' | 'finalize';
}

export type WorkerRequest =
  | {
      type: 'PROCESS';
      taskId: string;
      input: ArrayBuffer;
      inputName: string;
      mime: SupportedInput;
      options: CompressionOptions;
    }
  | { type: 'PING' };

export type WorkerResponse =
  | { type: 'READY' }
  | {
      type: 'PROGRESS';
      taskId: string;
      phase: 'decode' | 'resize' | 'encode' | 'finalize';
      progress?: number;
    }
  | { type: 'SUCCESS'; taskId: string; result: CompressionResult }
  | { type: 'ERROR'; taskId: string; code: CompressionErrorCode; message: string }
  | { type: 'PONG' };
