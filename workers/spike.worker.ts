import { encode as encodeJpeg, decode as decodeJpeg } from "@jsquash/jpeg";
import { encode as encodeWebp, decode as decodeWebp } from "@jsquash/webp";
import { optimise as optimisePng } from "@jsquash/oxipng";

export interface SpikeResultItem {
  format: "jpeg" | "webp" | "png";
  success: boolean;
  inputBytes: number;
  outputBytes: number;
  error?: string;
}

self.onmessage = async (event: MessageEvent) => {
  if (event.data?.type !== "RUN_SPIKE") return;

  const results: SpikeResultItem[] = [];

  // 1. Test 2x2 RGBA ImageData
  const width = 2;
  const height = 2;
  const rawRgba = new Uint8ClampedArray([
    255, 0, 0, 255,     // red
    0, 255, 0, 255,     // green
    0, 0, 255, 255,     // blue
    255, 255, 255, 255, // white
  ]);
  const testImageData = {
    data: rawRgba,
    width,
    height,
  } as ImageData;

  // Test JPEG
  try {
    const encoded = await encodeJpeg(testImageData, { quality: 80 });
    const decoded = await decodeJpeg(encoded);
    results.push({
      format: "jpeg",
      success: decoded.width === width && decoded.height === height,
      inputBytes: rawRgba.byteLength,
      outputBytes: encoded.byteLength,
    });
  } catch (err: any) {
    results.push({
      format: "jpeg",
      success: false,
      inputBytes: rawRgba.byteLength,
      outputBytes: 0,
      error: String(err?.message || err),
    });
  }

  // Test WebP
  try {
    const encoded = await encodeWebp(testImageData, { quality: 80 });
    const decoded = await decodeWebp(encoded);
    results.push({
      format: "webp",
      success: decoded.width === width && decoded.height === height,
      inputBytes: rawRgba.byteLength,
      outputBytes: encoded.byteLength,
    });
  } catch (err: any) {
    results.push({
      format: "webp",
      success: false,
      inputBytes: rawRgba.byteLength,
      outputBytes: 0,
      error: String(err?.message || err),
    });
  }

  // Test PNG (1x1 PNG in base64)
  try {
    const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const binaryStr = atob(base64Png);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const inputBuffer = bytes.buffer;
    const optimised = await optimisePng(inputBuffer, { level: 2 });
    results.push({
      format: "png",
      success: optimised.byteLength > 0,
      inputBytes: inputBuffer.byteLength,
      outputBytes: optimised.byteLength,
    });
  } catch (err: any) {
    results.push({
      format: "png",
      success: false,
      inputBytes: 0,
      outputBytes: 0,
      error: String(err?.message || err),
    });
  }

  self.postMessage({
    type: "SPIKE_RESULT",
    results,
    allPassed: results.every(r => r.success),
  });
};
