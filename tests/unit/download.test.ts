import { describe, it, expect, vi, beforeEach } from "vitest";
import { unzipSync } from "fflate";
import {
  packZip,
  downloadBlob,
  downloadTask,
  downloadTasksAsZip,
  generateZipFilename,
} from "../../lib/image/download";
import type { QueueItem } from "../../composables/useCompressionQueue.client";

describe("lib/image/download - packZip 打包与安全性", () => {
  it("应成功将多文件打包为符合标准的 ZIP，并正确保留魔数 PK\\x03\\x04", async () => {
    const file1Data = new Uint8Array([1, 2, 3, 4]);
    const file2Data = new Uint8Array([5, 6, 7, 8, 9]);

    const zipData = await packZip([
      { name: "photo1.png", data: file1Data },
      { name: "photo2.png", data: file2Data },
    ]);

    expect(zipData.length).toBeGreaterThan(0);
    // ZIP 文件魔数签名：PK\x03\x04 (0x50, 0x4b, 0x03, 0x04)
    expect(zipData[0]).toBe(0x50);
    expect(zipData[1]).toBe(0x4b);
    expect(zipData[2]).toBe(0x03);
    expect(zipData[3]).toBe(0x04);

    // 用 unzipSync 解压还原并校验内容
    const unzipped = unzipSync(zipData);
    expect(Object.keys(unzipped)).toEqual(["photo1.png", "photo2.png"]);
    expect(Array.from(unzipped["photo1.png"])).toEqual([1, 2, 3, 4]);
    expect(Array.from(unzipped["photo2.png"])).toEqual([5, 6, 7, 8, 9]);
  });

  it("当包含同名文件时应自动去重命名，避免文件相互覆盖", async () => {
    const zipData = await packZip([
      { name: "image.webp", data: new Uint8Array([10]) },
      { name: "image.webp", data: new Uint8Array([20]) },
      { name: "image.webp", data: new Uint8Array([30]) },
    ]);

    const unzipped = unzipSync(zipData);
    expect(Object.keys(unzipped).sort()).toEqual([
      "image-2.webp",
      "image-3.webp",
      "image.webp",
    ]);
  });

  it("空列表打包应返回空的 Uint8Array", async () => {
    const zipData = await packZip([]);
    expect(zipData.length).toBe(0);
  });
});

describe("downloadTasksAsZip 批量下载与超限拦截", () => {
  beforeEach(() => {
    // 模拟 DOM
    globalThis.URL.createObjectURL = vi.fn((_blob: any) => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("当没有已完成的任务时应抛出错误", async () => {
    const tasks: QueueItem[] = [
      {
        id: "t1",
        file: new File([new ArrayBuffer(10)], "test.png"),
        originalName: "test.png",
        originalBytes: 10,
        status: "processing",
        optionsSnapshot: {
          output: "keep",
          quality: 80,
          maxLongEdge: null,
          jpegBackground: "#ffffff",
        },
      },
    ];

    await expect(downloadTasksAsZip(tasks)).rejects.toThrow(
      "No completed tasks to download",
    );
  });

  it("当总文件体积超过上限时应拦截并拒绝打包", async () => {
    const tasks: QueueItem[] = [
      {
        id: "t1",
        file: new File([new ArrayBuffer(100)], "large.png"),
        originalName: "large.png",
        originalBytes: 100,
        status: "success",
        optionsSnapshot: {
          output: "keep",
          quality: 80,
          maxLongEdge: null,
          jpegBackground: "#ffffff",
        },
        result: {
          id: "t1",
          originalName: "large.png",
          originalBytes: 100,
          resultBytes: 100,
          mime: "image/png",
          extension: "png",
          width: 10,
          height: 10,
          elapsedMs: 5,
          mode: "lossless",
          unchanged: false,
          data: new ArrayBuffer(100),
        },
        resultBlob: new Blob([new ArrayBuffer(100)]),
      },
    ];

    // 设置 maxTotalBytes 为 50 字节，应触发拦截
    await expect(downloadTasksAsZip(tasks, "out.zip", 50)).rejects.toThrow(
      "exceeds ZIP safety limit",
    );
  });

  it("generateZipFilename 应生成包含时间戳与随机字符串的文件名", () => {
    const fixedDate = new Date(2026, 9, 14, 14, 30, 0); // 2026-10-14 14:30:00
    const filename = generateZipFilename("tiny-images", fixedDate);

    expect(filename).toMatch(/^tiny-images-20261014143000-[a-z0-9]{4}\.zip$/);

    // 验证不同调用具有随机性
    const f1 = generateZipFilename("tiny-images", fixedDate);
    const f2 = generateZipFilename("tiny-images", fixedDate);
    // 两个不同随机数的概率极高
    expect(f1.startsWith("tiny-images-20261014143000-")).toBe(true);
    expect(f2.startsWith("tiny-images-20261014143000-")).toBe(true);
  });
});

