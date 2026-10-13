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
import { probeDimensions } from "../dimensions";
import { encodeJpeg, decodeJpeg } from "./jpeg";
import { encodeWebp, decodeWebp } from "./webp";
import { optimisePng, decodePng } from "./png";
import { flattenAlphaToWhite } from "./alpha";
import { resizeImageData } from "./resize";

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
  const targetMime: SupportedOutput = resolveOutputMime(inputMime, options.output);
  const extension = resolveExtension(targetMime);

  // 1. 路径 A：PNG 原格式同尺寸无损优化通道（纯二进制 OxiPNG，绝不破坏像素语义）
  if (shouldUseLosslessPngPath(inputMime, targetMime, options.maxLongEdge)) {
    onProgress?.("encode");
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
      imageData = await decodeJpeg(inputBuffer);
      break;
    case "image/png":
      imageData = await decodePng(inputBuffer);
      break;
    case "image/webp":
      imageData = await decodeWebp(inputBuffer);
      break;
  }

  // 阶段 2：尺寸检查与重采样
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
      outputBuffer = await encodeJpeg(imageData, options.quality);
      mode = "lossy";
      break;
    case "image/webp":
      outputBuffer = await encodeWebp(imageData, options.quality);
      mode = "lossy";
      break;
    case "image/png":
      // PNG 格式重采样后的输出通道
      outputBuffer = await optimisePng(imageData, 2);
      mode = "lossless";
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
