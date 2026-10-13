import { describe, it, expect } from "vitest";
import { detectImageFormat } from "../../lib/image/magic";
import { probeDimensions, isPixelLimitExceeded } from "../../lib/image/dimensions";
import {
  resolveOutputMime,
  shouldUseLosslessPngPath,
  savingsPercent,
  formatBytes,
  calculateTargetDimensions,
  resolveExtension,
  sanitizeFilename,
  deduplicateFilenames,
} from "../../lib/image/policy";

describe("T01-01: 图片格式魔数与动画检测 (magic.ts)", () => {
  it("正确识别 JPEG 魔数头 (FF D8 FF)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = detectImageFormat(jpeg);
    expect(res).not.toBeNull();
    expect(res?.mime).toBe("image/jpeg");
    expect(res?.isAnimated).toBe(false);
  });

  it("正确识别标准静态 PNG", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, // IHDR length 13
      0x49, 0x48, 0x44, 0x52, // 'IHDR'
      0x00, 0x00, 0x00, 0x0a, // width 10
      0x00, 0x00, 0x00, 0x0a, // height 10
      0x08, 0x06, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND length 0
      0x49, 0x45, 0x4e, 0x44, // 'IEND'
      0xae, 0x42, 0x60, 0x82,
    ]);
    const res = detectImageFormat(png);
    expect(res).not.toBeNull();
    expect(res?.mime).toBe("image/png");
    expect(res?.isAnimated).toBe(false);
  });

  it("正确检测 APNG 动图（包含 acTL chunk）", () => {
    const apng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, // IHDR length
      0x49, 0x48, 0x44, 0x52, // 'IHDR'
      0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x0a, 0x08, 0x06, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // CRC
      0x00, 0x00, 0x00, 0x08, // acTL length 8
      0x61, 0x63, 0x54, 0x4c, // 'acTL'
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, // CRC
    ]);
    const res = detectImageFormat(apng);
    expect(res).not.toBeNull();
    expect(res?.mime).toBe("image/png");
    expect(res?.isAnimated).toBe(true);
  });

  it("正确识别静态 WebP", () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x20, 0x00, 0x00, 0x00, // file size
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20, // VP8_
      0x10, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const res = detectImageFormat(webp);
    expect(res).not.toBeNull();
    expect(res?.mime).toBe("image/webp");
    expect(res?.isAnimated).toBe(false);
  });

  it("正确检测动画 WebP（VP8X 动图标志位）", () => {
    const animatedWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x30, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x58, // VP8X
      0x0a, 0x00, 0x00, 0x00,
      0x02,                   // flags: bit 1 is animation flag (0x02)
      0x00, 0x00, 0x00,
      0x10, 0x00, 0x00,       // canvas width - 1
      0x10, 0x00, 0x00,       // canvas height - 1
    ]);
    const res = detectImageFormat(animatedWebp);
    expect(res).not.toBeNull();
    expect(res?.mime).toBe("image/webp");
    expect(res?.isAnimated).toBe(true);
  });

  it("对非图片二进制返回 null", () => {
    const textData = new TextEncoder().encode("<html><body>not image</body></html>");
    expect(detectImageFormat(textData)).toBeNull();
    expect(detectImageFormat(new Uint8Array([]))).toBeNull();
  });
});

describe("T01-01: 尺寸探测与像素限制 (dimensions.ts)", () => {
  it("探测 PNG 宽高", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x03, 0x20, // width 800
      0x00, 0x00, 0x02, 0x58, // height 600
    ]);
    const dims = probeDimensions(png);
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it("探测 JPEG 宽高", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,             // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0
      0xff, 0xc0,             // SOF0
      0x00, 0x0b,             // length
      0x08,                   // precision
      0x01, 0xe0,             // height 480
      0x02, 0x80,             // width 640
    ]);
    const dims = probeDimensions(jpeg);
    expect(dims).toEqual({ width: 640, height: 480 });
  });

  it("探测 VP8X WebP 宽高", () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x30, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x58,
      0x0a, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x7f, 0x00, 0x00,       // width - 1 = 127 -> width = 128
      0x3f, 0x00, 0x00,       // height - 1 = 63 -> height = 64
    ]);
    const dims = probeDimensions(webp);
    expect(dims).toEqual({ width: 128, height: 64 });
  });

  it("像素超限判断", () => {
    expect(isPixelLimitExceeded(8000, 6000, 32_000_000)).toBe(true);  // 48 MP > 32 MP
    expect(isPixelLimitExceeded(1920, 1080, 32_000_000)).toBe(false); // 2 MP < 32 MP
  });
});

describe("T01-01: 核心决策函数策略 (policy.ts)", () => {
  it("resolveOutputMime 正确决策", () => {
    expect(resolveOutputMime("image/jpeg", "keep")).toBe("image/jpeg");
    expect(resolveOutputMime("image/png", "keep")).toBe("image/png");
    expect(resolveOutputMime("image/jpeg", "webp")).toBe("image/webp");
    expect(resolveOutputMime("image/png", "jpeg")).toBe("image/jpeg");
  });

  it("shouldUseLosslessPngPath: 仅针对同格式且未改变尺寸的 PNG 生效", () => {
    expect(shouldUseLosslessPngPath("image/png", "image/png", null)).toBe(true);
    expect(shouldUseLosslessPngPath("image/png", "image/png", 1920)).toBe(false);
    expect(shouldUseLosslessPngPath("image/png", "image/webp", null)).toBe(false);
    expect(shouldUseLosslessPngPath("image/jpeg", "image/jpeg", null)).toBe(false);
  });

  it("savingsPercent 正确处理正值、负值与零", () => {
    expect(savingsPercent(1000, 600)).toBe(40);
    expect(savingsPercent(1000, 1200)).toBe(-20);
    expect(savingsPercent(1000, 1000)).toBe(0);
    expect(savingsPercent(0, 100)).toBe(0);
  });

  it("calculateTargetDimensions 等比缩放且不放大", () => {
    // 4000x2000, 限制最长边 2000 -> 2000x1000
    const scaled = calculateTargetDimensions(4000, 2000, 2000);
    expect(scaled).toEqual({ width: 2000, height: 1000, scaled: true });

    // 1920x1080, 限制最长边 2560 -> 不放大，保持原图
    const notScaled = calculateTargetDimensions(1920, 1080, 2560);
    expect(notScaled).toEqual({ width: 1920, height: 1080, scaled: false });

    // null 限制 -> 不缩放
    expect(calculateTargetDimensions(1920, 1080, null)).toEqual({
      width: 1920,
      height: 1080,
      scaled: false,
    });
  });

  it("resolveExtension 扩展名匹配", () => {
    expect(resolveExtension("image/jpeg")).toBe("jpg");
    expect(resolveExtension("image/png")).toBe("png");
    expect(resolveExtension("image/webp")).toBe("webp");
  });

  it("sanitizeFilename 防止路径穿越并规范扩展名", () => {
    expect(sanitizeFilename("../../etc/passwd.PNG", "webp")).toBe("____etc_passwd.webp");
    expect(sanitizeFilename("my photo.jpeg", "jpg")).toBe("my photo.jpg");
    expect(sanitizeFilename("special#*?:.webp", "png")).toBe("special____.png");
  });

  it("deduplicateFilenames 稳定去重", () => {
    const list = ["photo.webp", "photo.webp", "avatar.jpg", "photo.webp"];
    expect(deduplicateFilenames(list)).toEqual([
      "photo.webp",
      "photo-2.webp",
      "avatar.jpg",
      "photo-3.webp",
    ]);
  });

  it("formatBytes 人类可读字节格式化", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(2621440, 2)).toBe("2.5 MB");
  });
});
