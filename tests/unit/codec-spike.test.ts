import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { encode as encodeJpeg, decode as decodeJpeg } from "@jsquash/jpeg";
import { encode as encodeWebp, decode as decodeWebp } from "@jsquash/webp";
import { optimise as optimisePng } from "@jsquash/oxipng";

// Polyfill file:// fetch in Node.js test environment so jSquash can load local wasm files
beforeAll(() => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
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

describe("Codec Spike - Node / WASM Baseline", () => {
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

  it("JPEG: encodes ImageData to JPEG buffer and decodes back", async () => {
    const jpegBuffer = await encodeJpeg(testImageData, { quality: 80 });
    expect(jpegBuffer).toBeInstanceOf(ArrayBuffer);
    expect(jpegBuffer.byteLength).toBeGreaterThan(0);

    const bytes = new Uint8Array(jpegBuffer);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);

    const decoded = await decodeJpeg(jpegBuffer);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.data.length).toBe(width * height * 4);
  });

  it("WebP: encodes ImageData to WebP buffer and decodes back", async () => {
    const webpBuffer = await encodeWebp(testImageData, { quality: 80 });
    expect(webpBuffer).toBeInstanceOf(ArrayBuffer);
    expect(webpBuffer.byteLength).toBeGreaterThan(0);

    const bytes = new Uint8Array(webpBuffer);
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    expect(riff).toBe("RIFF");

    const decoded = await decodeWebp(webpBuffer);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
  });

  it("PNG: optimises valid 1x1 PNG via OxiPNG", async () => {
    const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const binary = Buffer.from(base64Png, "base64");
    const inputBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);

    const outputBuffer = await optimisePng(inputBuffer, { level: 2 });
    expect(outputBuffer).toBeInstanceOf(ArrayBuffer);
    expect(outputBuffer.byteLength).toBeGreaterThan(0);

    const bytes = new Uint8Array(outputBuffer);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });
});
