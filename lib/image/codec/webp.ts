import { encode, decode } from "@jsquash/webp";

/**
 * WebP 编解码适配器 (libwebp WASM)
 */
export async function encodeWebp(
  imageData: ImageData,
  quality: number = 80,
): Promise<ArrayBuffer> {
  const clampedQuality = Math.max(1, Math.min(100, Math.round(quality)));
  return encode(imageData, { quality: clampedQuality });
}

export async function decodeWebp(buffer: ArrayBuffer): Promise<ImageData> {
  return decode(buffer);
}
