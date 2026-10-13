export const DEFAULT_MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MiB
export const DEFAULT_MAX_PIXELS_DESKTOP = 32_000_000; // 32 MP
export const DEFAULT_MAX_PIXELS_MOBILE = 16_000_000; // 16 MP
export const MAX_BATCH_FILES = 20;

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * 从 PNG 二进制流头部 (IHDR chunk) 快速提取宽高
 */
function probePngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) return null;
  // IHDR width is at bytes [16..19], height at [20..23] (big-endian)
  const width =
    ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height =
    ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

/**
 * 从 WebP 二进制流快速提取宽高 (VP8, VP8L, VP8X)
 */
function probeWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    // 24-bit canvas width (1-based) at [24..26], height at [27..29]
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    // Lossy VP8 frame header starts around byte 23 with signature 0x9d 0x01 0x2a
    if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      return { width, height };
    }
  }

  if (chunkType === "VP8L" && bytes.length >= 25) {
    // Lossless VP8L signature byte is 0x2f at byte 20
    if (bytes[20] === 0x2f) {
      const b0 = bytes[21];
      const b1 = bytes[22];
      const b2 = bytes[23];
      const b3 = bytes[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + ((((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
      return { width, height };
    }
  }

  return null;
}

/**
 * 从 JPEG 二进制流标记中扫描 SOF 帧提取宽高
 */
function probeJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4) return null;
  let offset = 2; // 跳过 0xFF, 0xD8

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // SOF 标记列表 (0xC0..0xC3, 0xC5..0xC7, 0xC9..0xCB, 0xCD..0xCF)
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 8 < bytes.length) {
      // SOF 格式: [FF Marker] [Length: 2B] [Precision: 1B] [Height: 2B] [Width: 2B]
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    // 读取当前 marker 段长度跳至下一段
    if (offset + 3 < bytes.length) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    } else {
      break;
    }
  }

  return null;
}

/**
 * 轻量快速探测图片尺寸，无需完整解码全部分辨率像素
 */
export function probeDimensions(buffer: ArrayBuffer | Uint8Array): ImageDimensions | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return probePngDimensions(bytes);
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return probeJpegDimensions(bytes);
  }

  // WebP
  if (bytes[0] === 0x52 && bytes[1] === 0x49) {
    return probeWebpDimensions(bytes);
  }

  return null;
}

/**
 * 校验像素是否超过设备保护阈值
 */
export function isPixelLimitExceeded(
  width: number,
  height: number,
  maxPixels: number = DEFAULT_MAX_PIXELS_DESKTOP,
): boolean {
  return width * height > maxPixels;
}
