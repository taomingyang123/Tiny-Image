/**
 * JPEG 编解码适配器 (MozJPEG WASM)
 */
export async function encodeJpeg(
  imageData: ImageData,
  quality: number = 80,
): Promise<ArrayBuffer> {
  const { encode } = await import("@jsquash/jpeg");
  const clampedQuality = Math.max(1, Math.min(100, Math.round(quality)));
  return encode(imageData, { quality: clampedQuality });
}

export async function decodeJpeg(buffer: ArrayBuffer): Promise<ImageData> {
  const { decode } = await import("@jsquash/jpeg");
  return decode(buffer);
}
