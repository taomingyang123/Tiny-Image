import type {
  SupportedInput,
  SupportedOutput,
  OutputMode,
} from "./types";

/**
 * 根据输入 MIME 与用户选择的 OutputMode 解析目标输出 MIME
 */
export function resolveOutputMime(
  input: SupportedInput,
  option: OutputMode,
): SupportedOutput {
  if (option === "keep") return input;
  if (option === "jpeg") return "image/jpeg";
  if (option === "png") return "image/png";
  return "image/webp";
}

/**
 * 判断是否应走 PNG 二进制纯无损优化路径（直接通过 OxiPNG 处理，不经过重采样与色彩量化）
 * 核心准则：
 * 1. 保持原格式（keep）且未缩放尺寸时，PNG 默认 100% 走纯无损优化通道，保证每一个像素与半透明渐变投影绝对不变，绝不改图；
 * 2. 只有当明确转为 PNG 且质量参数 < 100 时，才走智能色彩量化通道。
 */
export function shouldUseLosslessPngPath(
  input: SupportedInput,
  output: SupportedOutput,
  maxLongEdge: number | null,
  outputMode: OutputMode = "keep",
  quality?: number,
): boolean {
  if (input !== "image/png" || output !== "image/png" || maxLongEdge !== null) {
    return false;
  }
  // 保持原格式时，必须保证绝对无损
  if (outputMode === "keep") {
    return true;
  }
  return typeof quality !== "number" || quality >= 100;
}

/**
 * 计算体积节省百分比：(originalBytes - resultBytes) / originalBytes * 100
 * 支持负值以如实展示体积增加
 */
export function savingsPercent(
  originalBytes: number,
  resultBytes: number,
): number {
  if (originalBytes <= 0) return 0;
  const percent = ((originalBytes - resultBytes) / originalBytes) * 100;
  return Math.round(percent * 10) / 10;
}

/**
 * 格式化字节大小为人类可读字符串 (B, KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * 依据最长边上限计算目标缩放尺寸，保证等比缩放、不放大、宽高度不小于 1
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxLongEdge: number | null,
): { width: number; height: number; scaled: boolean } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height), scaled: false };
  }

  const currentLongEdge = Math.max(width, height);
  if (!maxLongEdge || maxLongEdge <= 0 || currentLongEdge <= maxLongEdge) {
    return { width, height, scaled: false };
  }

  const scale = maxLongEdge / currentLongEdge;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  return {
    width: targetWidth,
    height: targetHeight,
    scaled: true,
  };
}

/**
 * 根据输出 MIME 返回对应文件扩展名
 */
export function resolveExtension(mime: SupportedOutput): "jpg" | "png" | "webp" {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}

/**
 * 清理文件名：防范路径穿越 (../, ..\\)、不可见控制字符，并替换扩展名
 */
export function sanitizeFilename(
  originalName: string,
  targetExt: "jpg" | "png" | "webp",
): string {
  // 1. 移除路径分割符与不安全文件名字符、处理连续点号
  let safeBase = originalName
    .replace(/[/\\?%*:|"<>#]/g, "_")
    .replace(/\.\.+/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f\x80-\x9f]/g, "")
    .trim();

  // 2. 剥离原有扩展名
  const dotIndex = safeBase.lastIndexOf(".");
  if (dotIndex > 0) {
    safeBase = safeBase.substring(0, dotIndex);
  }

  // 3. 若清理后为空或全是下划线，兜底为 image
  if (!safeBase || !safeBase.replace(/_/g, "")) {
    safeBase = "image";
  }

  return `${safeBase}.${targetExt}`;
}

/**
 * 对批量导出的文件名进行稳定去重（例如 photo.webp, photo-2.webp）
 */
export function deduplicateFilenames(names: string[]): string[] {
  const used = new Set<string>();
  const reserved = new Set(names.map(name => name.toLowerCase()));
  return names.map((name) => {
    const dotIndex = name.lastIndexOf(".");
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      do { candidate = `${base}-${suffix++}${ext}`; }
      while (used.has(candidate.toLowerCase()) || reserved.has(candidate.toLowerCase()));
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
