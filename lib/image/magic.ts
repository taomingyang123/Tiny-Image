import type { SupportedInput } from "./types";

export interface FormatDetectionResult {
  mime: SupportedInput;
  isAnimated: boolean;
}

/**
 * 检查 PNG 二进制流中是否包含 APNG 动图专有的 'acTL' chunk
 */
function isApng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  let offset = 8; // 跳过 8 字节 PNG 签名

  while (offset + 8 <= bytes.length) {
    const chunkLength =
      ((bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>>
      0;
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );

    if (chunkType === "acTL") {
      return true;
    }

    if (chunkType === "IEND") {
      break;
    }

    // 每个 chunk 由 4字节长度 + 4字节类型 + chunkLength内容 + 4字节CRC 组成
    offset += 8 + chunkLength + 4;
  }
  return false;
}

/**
 * 检查 WebP 二进制流是否包含动画（VP8X 动图标志位或 ANIM chunk）
 */
function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;

  // 检查是否为 Extended WebP (VP8X)
  const format = String.fromCharCode(
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15],
  );

  if (format === "VP8X" && bytes.length >= 21) {
    // 偏移量 20 是 flags 字节，Bit 1 (0x02) 表示包含 Animation
    const flags = bytes[20];
    if ((flags & 0x02) !== 0) {
      return true;
    }
  }

  // Walk actual RIFF chunk boundaries; payload bytes are not chunk identifiers.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (tag === "ANIM" || tag === "ANMF") return true;
    const length = view.getUint32(offset + 4, true);
    offset += 8 + length + (length % 2);
  }

  return false;
}

/**
 * 根据文件头魔数识别图片真实格式与动画状态，不信任扩展名
 */
export function detectImageFormat(
  buffer: ArrayBuffer | Uint8Array,
): FormatDetectionResult | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length < 4) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      mime: "image/jpeg",
      isAnimated: false,
    };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const isAnimated = isApng(bytes);
    return {
      mime: "image/png",
      isAnimated,
    };
  }

  // 3. WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    const isAnimated = isAnimatedWebp(bytes);
    return {
      mime: "image/webp",
      isAnimated,
    };
  }

  return null;
}
