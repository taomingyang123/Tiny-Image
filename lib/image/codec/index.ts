import type {
  SupportedInput,
  SupportedOutput,
  CompressionOptions,
  CompressionResult,
} from "../types";
import {
  resolveOutputMime,
  shouldUseLosslessPngPath,
  calculateTargetDimensions,
  resolveExtension,
} from "../policy";
import { probeDimensions, isPixelLimitExceeded } from "../dimensions";
import { detectImageFormat } from "../magic";



import { flattenAlphaToWhite } from "./alpha";
import { resizeImageData } from "./resize";
import { quantizeImageData } from "./quantize";

export interface ProcessImageParams {
  id: string;
  originalName: string;
  inputBuffer: ArrayBuffer;
  inputMime: SupportedInput;
  options: CompressionOptions;
  onProgress?: (phase: "decode" | "resize" | "encode" | "finalize") => void;
}

/**
 * 核心图片压缩与格式转换处理管线
 */
export async function processImage(
  params: ProcessImageParams,
): Promise<CompressionResult> {
  const { id, originalName, inputBuffer, inputMime, options, onProgress } = params;
  const startTime = Date.now();
  const originalBytes = inputBuffer.byteLength;
  const detected = detectImageFormat(inputBuffer);
  const dims = probeDimensions(inputBuffer);
  const reject = (code: string) => { throw Object.assign(new Error(code), { code }); };
  if (!detected || detected.mime !== inputMime) reject("INVALID_FILE");
  if (detected?.isAnimated) reject("ANIMATED_UNSUPPORTED");
  if (!dims || dims.width <= 0 || dims.height <= 0) reject("INVALID_FILE");
  if (dims && isPixelLimitExceeded(dims.width, dims.height)) reject("PIXEL_LIMIT");
  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100 ||
      (options.maxLongEdge !== null && (!Number.isInteger(options.maxLongEdge) || options.maxLongEdge < 1 || options.maxLongEdge > 10000))) reject("INVALID_FILE");
  const targetMime: SupportedOutput = resolveOutputMime(inputMime, options.output);
  const extension = resolveExtension(targetMime);

  // 1. 路径 A：PNG 原格式同尺寸（或显式质量100）纯二进制无损优化通道（保护像素与所有透明光晕）
  if (shouldUseLosslessPngPath(inputMime, targetMime, options.maxLongEdge, options.output, options.quality)) {
    onProgress?.("encode");
    const { optimisePng } = await import("./png");
    const optimisedBuffer = await optimisePng(inputBuffer, 2);

    // 探测原始尺寸供结果展示
    const dims = probeDimensions(inputBuffer) || { width: 0, height: 0 };
    const elapsedMs = Date.now() - startTime;

    // 若无损优化后体积没有减少，则保留原图字节，标注 unchanged: true
    if (optimisedBuffer.byteLength >= originalBytes) {
      onProgress?.("finalize");
      return {
        id,
        originalName,
        originalBytes,
        resultBytes: originalBytes,
        mime: "image/png",
        extension: "png",
        width: dims.width,
        height: dims.height,
        elapsedMs,
        mode: "lossless",
        unchanged: true,
        data: inputBuffer,
      };
    }

    onProgress?.("finalize");
    return {
      id,
      originalName,
      originalBytes,
      resultBytes: optimisedBuffer.byteLength,
      mime: "image/png",
      extension: "png",
      width: dims.width,
      height: dims.height,
      elapsedMs,
      mode: "lossless",
      unchanged: false,
      data: optimisedBuffer,
    };
  }

  // 2. 路径 B / C：解码 -> 可选缩放 -> 可选透明底填充 -> 重新编码
  // 阶段 1：解码为 ImageData
  onProgress?.("decode");
  let imageData: ImageData;
  switch (inputMime) {
    case "image/jpeg":
      imageData = await (await import("./jpeg")).decodeJpeg(inputBuffer);
      break;
    case "image/png":
      imageData = await (await import("./png")).decodePng(inputBuffer);
      break;
    case "image/webp":
      imageData = await (await import("./webp")).decodeWebp(inputBuffer);
      break;
  }

  // 阶段 2：尺寸检查与重采样
  if (isPixelLimitExceeded(imageData.width, imageData.height)) reject("PIXEL_LIMIT");
  const origWidth = imageData.width;
  const origHeight = imageData.height;
  const { width: targetW, height: targetH, scaled } = calculateTargetDimensions(
    origWidth,
    origHeight,
    options.maxLongEdge,
  );

  if (scaled) {
    onProgress?.("resize");
    imageData = resizeImageData(imageData, targetW, targetH);
  }

  // 阶段 3：透明通道处理（输出 JPEG 时填充纯白底，杜绝黑底）
  if (targetMime === "image/jpeg") {
    imageData = flattenAlphaToWhite(imageData);
  }

  // 阶段 4：目标格式编码
  onProgress?.("encode");
  let outputBuffer: ArrayBuffer;
  let mode: "lossy" | "lossless" = "lossy";

  switch (targetMime) {
    case "image/jpeg":
      outputBuffer = await (await import("./jpeg")).encodeJpeg(imageData, options.quality);
      mode = "lossy";
      break;
    case "image/webp":
      outputBuffer = await (await import("./webp")).encodeWebp(imageData, options.quality);
      mode = "lossy";
      break;
    case "image/png":
      // PNG 格式输出：质量 < 100 时执行智能色彩量化（类似 TinyPNG），质量 100 时保留全彩
      if (options.output === "png" && options.quality < 100) {
        imageData = quantizeImageData(imageData, { quality: options.quality });
        mode = "lossy";
      } else {
        mode = "lossless";
      }
      outputBuffer = await (await import("./png")).optimisePng(imageData, 2);
      break;
  }

  onProgress?.("finalize");
  const elapsedMs = Date.now() - startTime;

  return {
    id,
    originalName,
    originalBytes,
    resultBytes: outputBuffer.byteLength,
    mime: targetMime,
    extension,
    width: imageData.width,
    height: imageData.height,
    elapsedMs,
    mode,
    unchanged: false,
    data: outputBuffer,
  };
}
