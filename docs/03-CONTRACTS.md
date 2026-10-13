# 03｜TypeScript 数据契约、Worker 消息和状态机

> 以下为执行契约草案，Codex 必须据此实现可编译的源文件、单元测试和浏览器端对接。具体 codec API 以当前锁定版本类型定义为准。

## 1. TypeScript 合约

```ts
export type SupportedInput = 'image/jpeg' | 'image/png' | 'image/webp';
export type SupportedOutput = SupportedInput;
export type OutputMode = 'keep' | 'jpeg' | 'webp';

export interface CompressionOptions {
  output: OutputMode;
  quality: number;              // 整数 1..100；仅 JPEG/WebP 编码生效
  maxLongEdge: number | null;  // null 不缩放；1..10000 为有效正整数
  jpegBackground: '#ffffff';   // v1 固定白色；后续扩展
}

export type CompressionStatus =
  | 'idle' | 'validating' | 'queued' | 'processing'
  | 'success' | 'skipped' | 'failed' | 'cancelled';

export type CompressionErrorCode =
  | 'UNSUPPORTED_FORMAT' | 'ANIMATED_UNSUPPORTED' | 'INVALID_FILE'
  | 'FILE_TOO_LARGE' | 'PIXEL_LIMIT' | 'DECODE_FAILED'
  | 'ENCODE_FAILED' | 'WASM_LOAD_FAILED' | 'UNSUPPORTED_BROWSER'
  | 'OUT_OF_MEMORY' | 'TIMEOUT' | 'CANCELLED' | 'ZIP_TOO_LARGE'
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
  unchanged: boolean;          // PNG 无损结果未比原图更小时 true
  data: ArrayBuffer;           // 传回主线程，主线程创建 Blob
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
}
```

> 注意：数据协议中只传 JSON 可序列化配置和 ArrayBuffer 等结构化克隆允许的对象。禁止传 callback、DOM 对象、Vue 响应式代理到 Worker。

## 2. Worker 协议草案

```ts
export type WorkerRequest =
  | { type: 'PROCESS'; taskId: string; input: ArrayBuffer; inputName: string; mime: SupportedInput; options: CompressionOptions }
  | { type: 'PING' };

export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; taskId: string; phase: 'decode' | 'resize' | 'encode' | 'finalize'; progress?: number }
  | { type: 'SUCCESS'; taskId: string; result: CompressionResult }
  | { type: 'ERROR'; taskId: string; code: CompressionErrorCode; message: string }
  | { type: 'PONG' };
```

- `postMessage` 的 ArrayBuffer 必须使用 transfer list。转移后主线程的 `input` buffer 失效，因此原始 `File` 对象必须保留供重试/下载原图使用。
- `PROGRESS` 的数字百分比仅编码器能准确提供时上报；否则展示阶段进度/不确定进度条，不伪造线性 10–90% 数字。
- `CANCEL` 不做软取消协议承诺：由主线程 `worker.terminate()` 强制中止活动任务并重建 Worker；对用户状态置为 cancelled，保证不会收到旧 Worker 的过期响应（以 Worker 实例+taskId token 校验）。
- 任务失败、超时、用户切换路由、卸载组件、清空队列时释放所有资源。单个任务失败不阻断其他队列成员。

## 3. 状态转换

- `idle → validating → queued → processing → success|skipped|failed|cancelled`
- `validating → failed`（校验未通过）
- `queued → cancelled`（还未运行直接取消）
- `failed|cancelled → queued`（用户明确重试）
- `success|skipped → removed`（删除条目，释放 Blob URL）

全部状态转换由队列管理器集中执行；不要让多个子组件直接随意修改状态。

## 4. 核心决策函数

```ts
function resolveOutputMime(input: SupportedInput, option: OutputMode): SupportedOutput {
  if (option === 'keep') return input;
  return option === 'jpeg' ? 'image/jpeg' : 'image/webp';
}

function shouldUseLosslessPngPath(input: SupportedInput, output: SupportedOutput, maxLongEdge: number | null): boolean {
  return input === 'image/png' && output === 'image/png' && maxLongEdge === null;
}

function savingsPercent(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0;
  return ((inputBytes - outputBytes) / inputBytes) * 100;
}
```

- PNG 无损输出如 `optimised.byteLength >= input.byteLength`，直接输出原始 PNG 字节，标记 `unchanged:true`、`status:skipped`，不得夸大优化。
- JPEG/WebP 编码器输出比原图更大时，仍作为有损结果返回、展示“体积增加 N%”并允许使用原图；不自动拿原图冒充“新质量的压缩结果”。
- 需要降采样时，`scale = min(1, maxLongEdge / max(width,height))`，宽高取整、不得归零、不得放大。PNG 同格式如调整尺寸，则采用有意识的“重编码尺寸调整”路径，其无损优化定义仅针对已重采样像素，不能称“与原图像素完全一致”。
- JPEG 输出 extension 为 `jpg`，其他输出扩展名分别为 png/webp；处理大小写与同名冲突；不要信任原始文件 MIME。

## 5. 错误映射与用户显示

| Code | 用户友好提示 | 重试策略 |
|---|---|---|
| UNSUPPORTED_FORMAT | 暂不支持此格式，请选择 JPG、PNG 或 WebP | 否 |
| ANIMATED_UNSUPPORTED | 当前版本暂不支持动图压缩 | 否 |
| FILE_TOO_LARGE | 单张文件超过当前限制 | 否，除非换文件 |
| PIXEL_LIMIT | 图片像素过大，为保护设备已停止处理 | 否，除非换更小文件 |
| DECODE_FAILED | 图片无法解析，文件可能损坏 | 可重试一次 |
| ENCODE_FAILED | 压缩失败，可重试或降低尺寸 | 是 |
| WASM_LOAD_FAILED | 压缩模块载入失败，请检查网络或重试 | 是 |
| UNSUPPORTED_BROWSER | 当前浏览器缺少必要能力，请更新浏览器 | 换浏览器 |
| OUT_OF_MEMORY | 设备内存不足，请减少任务数量或缩小图片 | 视情况 |
| TIMEOUT | 本次处理超时，请重试或缩小图片 | 是 |
| CANCELLED | 已取消 | 可以 |

本地化 key 建议 `errors.UNSUPPORTED_FORMAT` 等，不要在 composable 中硬编码中文。

## 6. 校验策略

- 格式识别：JPEG FF D8 FF；PNG 固定签名；WebP `RIFF....WEBP`。校验文件完整性仍以实际解码成功为准。
- 对 PNG 检查 APNG `acTL` chunk；对 WebP 检查 VP8X animation 标志/ANIM 关键块；不能只靠后缀判断动画。
- 拒绝 0-byte 文件、伪造 MIME、极高宽高、超像素、超文件上限以及非图片内容。
- 使用 `AbortController` 取消 UI 的异步预览；不可在 wasm encode 正运行时仅依赖 AbortController 取消，需要终止 Worker。

## 7. 单元测试覆盖

- resolveOutputMime 每个输入/选项组合；quality 边界；scale 不放大且舍入正确。
- savingsPercent 负值、0、浮点、极小文件；PNG `skip` 规则；同名文件去重和路径清理。
- 消息收发 ID 不匹配被丢弃；超时停止与重试；Worker 终止后状态不被旧事件覆盖。
- ZIP manifest 只包含 success/skipped 且 Blob 有效的条目；路径不能出现 `../`。
