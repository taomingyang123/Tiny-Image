import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { quantizeImageData, resolvePaletteSize } from "../../lib/image/codec/quantize";

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

describe("T04-07 · PNG 色彩量化与调色板抖动算法", () => {
  it("resolvePaletteSize 应根据质量等级正确映射调色板颜色总数", () => {
    expect(resolvePaletteSize(100)).toBe(256);
    expect(resolvePaletteSize(80)).toBe(256);
    expect(resolvePaletteSize(75)).toBe(256);
    expect(resolvePaletteSize(60)).toBe(128);
    expect(resolvePaletteSize(40)).toBe(64);
    expect(resolvePaletteSize(10)).toBe(32);
  });

  it("对纯色图像量化后应精确还原该颜色", () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    // 全部填充纯红
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    const fakeImageData = { data, width, height } as unknown as ImageData;
    const result = quantizeImageData(fakeImageData, { quality: 80, dither: false });

    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
    expect(result.data[3]).toBe(255);
  });

  it("透明通道保护：透明像素在量化后应保持完全透明", () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    // 前半部分纯绿，后半部分透明
    for (let i = 0; i < 8 * 4; i += 4) {
      data[i] = 0;
      data[i + 1] = 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    for (let i = 8 * 4; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0; // 完全透明
    }

    const fakeImageData = { data, width, height } as unknown as ImageData;
    const result = quantizeImageData(fakeImageData, { quality: 80, dither: true });

    // 检查透明像素
    const transparentOffset = 8 * 4;
    expect(result.data[transparentOffset + 3]).toBe(0);
  });

  it("半透明投影与霓虹发光光晕保护：量化后每个像素的 Alpha 梯度必须 100% 忠实保留，绝不变成实色", () => {
    // 模拟外围带有红色半透明发光渐变的文字/边框
    const width = 3;
    const height = 1;
    const data = new Uint8ClampedArray([
      255, 0, 0, 30,   // 弱发光 (alpha = 30)
      255, 0, 0, 95,   // 中等光晕 (alpha = 95)
      255, 0, 0, 180,  // 较强光晕 (alpha = 180)
    ]);

    const fakeImageData = { data, width, height } as unknown as ImageData;
    const result = quantizeImageData(fakeImageData, { quality: 80, dither: false });

    // 严密断言：每一个像素的 Alpha 必须与其原本完全一致，绝不能被强制变成 255 实心不透明！
    expect(result.data[3]).toBe(30);
    expect(result.data[7]).toBe(95);
    expect(result.data[11]).toBe(180);
  });

  it("对于渐变图片，量化后颜色种数应被严格收敛至目标调色板上限", () => {
    const width = 50;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 255);
        data[idx + 1] = Math.round((y / height) * 255);
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    const fakeImageData = { data, width, height } as unknown as ImageData;
    // 量化到 64 色，不启用抖动以便准确统计颜色种数
    const result = quantizeImageData(fakeImageData, { quality: 40, dither: false });

    const uniqueColors = new Set<string>();
    for (let i = 0; i < result.data.length; i += 4) {
      uniqueColors.add(
        `${result.data[i]},${result.data[i + 1]},${result.data[i + 2]},${result.data[i + 3]}`,
      );
    }

    // 颜色种数必须被压缩在 64 色以内
    expect(uniqueColors.size).toBeLessThanOrEqual(64);
  });

  it("实测：256 色量化后的图像经 OxiPNG 压缩，体积相比未量化真彩有明显下降", async () => {
    const { optimisePng } = await import("../../lib/image/codec/png");
    const width = 120;
    const height = 120;
    const rawData = new Uint8ClampedArray(width * height * 4);
    // 模拟写实纹理与照片高频细节（自然图片特征：多频波形与局部色彩分布）
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const wave1 = Math.sin(x / 4) * 60;
        const wave2 = Math.cos(y / 6) * 60;
        const wave3 = Math.sin((x + y) / 5) * 50;
        rawData[idx] = Math.min(255, Math.max(0, Math.round(128 + wave1 + wave2)));
        rawData[idx + 1] = Math.min(255, Math.max(0, Math.round(128 + wave2 + wave3)));
        rawData[idx + 2] = Math.min(255, Math.max(0, Math.round(128 + wave1 - wave3)));
        rawData[idx + 3] = 255;
      }
    }

    const unquantizedImageData = { data: rawData, width, height } as unknown as ImageData;
    const unquantizedBuffer = await optimisePng(unquantizedImageData, 2);

    // 采用自适应调色板量化
    const quantizedImageData = quantizeImageData(unquantizedImageData, { quality: 80, dither: false });
    const quantizedBuffer = await optimisePng(quantizedImageData, 2);

    // 量化后体积必须明显小于未量化真彩体积
    expect(quantizedBuffer.byteLength).toBeLessThan(unquantizedBuffer.byteLength);

    const savingRatio = (unquantizedBuffer.byteLength - quantizedBuffer.byteLength) / unquantizedBuffer.byteLength;
    expect(savingRatio).toBeGreaterThan(0.2);
  });
});
