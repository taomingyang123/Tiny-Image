import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { flattenAlphaToWhite } from "../../lib/image/codec/alpha";
import { resizeImageData } from "../../lib/image/codec/resize";
import { processImage } from "../../lib/image/codec";
import { encodeJpeg } from "../../lib/image/codec/jpeg";
import { encodeWebp } from "../../lib/image/codec/webp";

// Node.js test environment file:// fetch polyfill for jSquash WASM
beforeAll(() => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;
    if (urlStr.startsWith("file:")) {
      const buffer = fs.readFileSync(fileURLToPath(urlStr));
      return new Response(buffer, {
        status: 200,
        headers: { "Content-Type": "application/wasm" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
});

describe("T01-02: Codec 适配器与图像管线 (lib/image/codec/)", () => {
  it("flattenAlphaToWhite: 透明底填充白底且杜绝黑底", () => {
    // 2x1 ImageData: pixel 0 is transparent, pixel 1 is solid blue
    const raw = new Uint8ClampedArray([
      255, 0, 0, 0,       // 完全透明红 -> 应变为纯白 (255, 255, 255, 255)
      0, 0, 255, 255,     // 纯蓝不透明 -> 保持不变
    ]);
    const src = { data: raw, width: 2, height: 1 } as ImageData;
    const flattened = flattenAlphaToWhite(src);

    expect(flattened.data[0]).toBe(255);
    expect(flattened.data[1]).toBe(255);
    expect(flattened.data[2]).toBe(255);
    expect(flattened.data[3]).toBe(255);

    expect(flattened.data[4]).toBe(0);
    expect(flattened.data[5]).toBe(0);
    expect(flattened.data[6]).toBe(255);
    expect(flattened.data[7]).toBe(255);
  });

  it("resizeImageData: 双线性插值平滑缩小尺寸", () => {
    // 4x4 单色测试图
    const srcRaw = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const src = { data: srcRaw, width: 4, height: 4 } as ImageData;
    const resized = resizeImageData(src, 2, 2);

    expect(resized.width).toBe(2);
    expect(resized.height).toBe(2);
    expect(resized.data.length).toBe(2 * 2 * 4);
    expect(resized.data[0]).toBe(128);
  });

  it("processImage: 路径 A - PNG 原格式无损直接优化通道", async () => {
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const binary = Buffer.from(base64Png, "base64");
    const inputBuffer = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength,
    );

    const result = await processImage({
      id: "task-1",
      originalName: "test.png",
      inputBuffer,
      inputMime: "image/png",
      options: {
        output: "keep",
        quality: 100,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
    });

    expect(result.mime).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.mode).toBe("lossless");
    expect(result.resultBytes).toBeGreaterThan(0);
  });

  it("processImage: 路径 A2 - PNG 智能色彩量化深度压缩通道 (quality < 100)", async () => {
    // 构造一个 4x4 RGBA 的有效 PNG 缓冲
    const fixturePath = "tests/unit/fixtures/sample.png";
    let inputBuffer: ArrayBuffer;
    if (fs.existsSync(fixturePath)) {
      const buf = fs.readFileSync(fixturePath);
      inputBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else {
      const binary = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZSURBVBhXY2AYBYqLi//D8V98fHyMhBEAAJ0/CQVq+f6KAAAAAElFTkSuQmCC",
        "base64",
      );
      inputBuffer = binary.buffer.slice(
        binary.byteOffset,
        binary.byteOffset + binary.byteLength,
      );
    }

    const result = await processImage({
      id: "task-png-quant",
      originalName: "test-quant.png",
      inputBuffer,
      inputMime: "image/png",
      options: {
        output: "png",
        quality: 80,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
    });

    expect(result.mime).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.mode).toBe("lossy");
    expect(result.resultBytes).toBeGreaterThan(0);
  });

  it("processImage: 路径 B - JPEG 有损重编码与质量参数生效", async () => {
    const src = {
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
      width: 2,
      height: 1,
    } as ImageData;
    const inputJpeg = await encodeJpeg(src, 90);

    const result = await processImage({
      id: "task-2",
      originalName: "photo.jpg",
      inputBuffer: inputJpeg,
      inputMime: "image/jpeg",
      options: {
        output: "keep",
        quality: 75,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
    });

    expect(result.mime).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(result.mode).toBe("lossy");
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);

    const bytes = new Uint8Array(result.data);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  it("processImage: 格式转换 - PNG 转换为 WebP", async () => {
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const binary = Buffer.from(base64Png, "base64");
    const inputBuffer = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength,
    );

    const result = await processImage({
      id: "task-3",
      originalName: "graphic.png",
      inputBuffer,
      inputMime: "image/png",
      options: {
        output: "webp",
        quality: 80,
        maxLongEdge: null,
        jpegBackground: "#ffffff",
      },
    });

    expect(result.mime).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.mode).toBe("lossy");

    const bytes = new Uint8Array(result.data);
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    expect(riff).toBe("RIFF");
  });

  it("processImage: 尺寸缩放 - 超限最长边等比降采样", async () => {
    const src = {
      data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
      width: 4,
      height: 4,
    } as ImageData;
    const inputWebp = await encodeWebp(src, 80);

    const result = await processImage({
      id: "task-4",
      originalName: "large.webp",
      inputBuffer: inputWebp,
      inputMime: "image/webp",
      options: {
        output: "webp",
        quality: 80,
        maxLongEdge: 2, // 限制最长边为 2
        jpegBackground: "#ffffff",
      },
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});
