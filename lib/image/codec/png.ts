import initOxipng, {
  optimise as oxipngOptimise,
  optimise_raw as oxipngOptimiseRaw,
} from "@jsquash/oxipng/codec/pkg/squoosh_oxipng.js";
import { decode } from "@jsquash/png";

let oxipngReady: Promise<unknown> | null = null;

async function ensureOxipngReady(): Promise<void> {
  if (!oxipngReady) {
    oxipngReady = initOxipng();
  }
  await oxipngReady;
}

/**
 * PNG 编解码适配器 (单线程安全版 OxiPNG 二进制优化 + PNG WASM 解码)
 * 纯单线程执行，不依赖 SharedArrayBuffer 与 COOP/COEP 隔离，无需多线程隔离，仍需验证目标浏览器兼容性
 */
export interface OptimisePngOptions {
  level?: number;
  quality?: number;
}

function isImageDataLike(val: any): val is ImageData {
  return (
    (typeof ImageData !== "undefined" && val instanceof ImageData) ||
    (Boolean(val) && typeof val.width === "number" && typeof val.height === "number" && Boolean(val.data))
  );
}

/**
 * PNG 编解码适配器 (单线程安全版 OxiPNG 二进制优化 + PNG WASM 解码)
 * 纯单线程执行，不依赖 SharedArrayBuffer 与 COOP/COEP 隔离，无需多线程隔离，仍需验证目标浏览器兼容性
 */
export async function optimisePng(
  bufferOrImageData: ArrayBuffer | Uint8Array | ImageData,
  levelOrOptions: number | OptimisePngOptions = 2,
): Promise<ArrayBuffer> {
  await ensureOxipngReady();

  const options: OptimisePngOptions =
    typeof levelOrOptions === "number" ? { level: levelOrOptions } : levelOrOptions;
  const clampedLevel = Math.max(1, Math.min(6, Math.round(options.level ?? 2)));

  if (isImageDataLike(bufferOrImageData)) {
    const rawRes = oxipngOptimiseRaw(
      bufferOrImageData.data,
      bufferOrImageData.width,
      bufferOrImageData.height,
      clampedLevel,
      false,
      false,
    );
    return rawRes.slice().buffer;
  }

  const bytes =
    bufferOrImageData instanceof Uint8Array
      ? bufferOrImageData
      : new Uint8Array(bufferOrImageData);

  const res = oxipngOptimise(bytes, clampedLevel, false, false);
  return res.slice().buffer;
}

export async function decodePng(buffer: ArrayBuffer): Promise<ImageData> {
  return decode(buffer);
}
