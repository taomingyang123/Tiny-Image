import { zip, type Zippable } from "fflate";
import { sanitizeFilename, deduplicateFilenames, resolveExtension } from "./policy";
import type { QueueItem } from "../../composables/useCompressionQueue.client";

export const DEFAULT_MAX_ZIP_BYTES = 100 * 1024 * 1024; // 100 MiB 客户端安全保护上限

/**
 * 触发浏览器本地下载单个 Blob 文件
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 下载单个任务的压缩或原始产物
 */
export function downloadTask(task: QueueItem): void {
  if (!task.resultBlob && !task.file) {
    throw new Error("No downloadable content available for task");
  }

  const blob = task.resultBlob || task.file;
  const ext = task.result?.extension || "png";
  const filename = sanitizeFilename(task.originalName, ext);
  downloadBlob(blob, filename);
}

export function downloadOriginalTask(task: QueueItem): void {
  if (!task.detectedMime) throw new Error("Input format is unavailable");
  downloadBlob(task.file, sanitizeFilename(task.originalName, resolveExtension(task.detectedMime)));
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * 基于 fflate 将多个文件打包为 ZIP 二进制 Uint8Array
 * 图片数据本身已高度压缩，默认采用 level: 0 归档存储，避免浪费 CPU 与造成 UI 卡顿
 */
export function packZip(entries: ZipEntry[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (entries.length === 0) {
      resolve(new Uint8Array(0));
      return;
    }

    // 1. 抽取文件名并执行稳定去重与清理
    const rawNames = entries.map((e) => e.name);
    const uniqueNames = deduplicateFilenames(rawNames);

    // 2. 构造 fflate Zippable 数据对象
    const zippable: Zippable = {};
    for (let i = 0; i < entries.length; i++) {
      zippable[uniqueNames[i]] = entries[i].data;
    }

    // 3. 执行异步 ZIP 打包
    zip(zippable, { level: 0 }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * 生成带时间戳与随机字符串的 ZIP 打包文件名
 * 格式示例：tiny-images-20261014144024-a1b2.zip
 */
export function generateZipFilename(prefix = "tiny-images", date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const timestamp = `${y}${m}${d}${h}${min}${s}`;
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${randomStr}.zip`;
}

/**
 * 批量将多个已完成的图片任务打包并触发 ZIP 下载
 */
export async function downloadTasksAsZip(
  tasks: QueueItem[],
  zipFilename = generateZipFilename(),
  maxTotalBytes = DEFAULT_MAX_ZIP_BYTES,
): Promise<void> {
  const completedTasks = tasks.filter(
    (t) =>
      (t.status === "success" || t.status === "skipped") &&
      (t.resultBlob || t.file),
  );

  if (completedTasks.length === 0) {
    throw new Error("No completed tasks to download");
  }

  // 1. 累计总体积并检查设备安全限制
  let totalBytes = 0;
  for (const t of completedTasks) {
    totalBytes += t.result?.resultBytes || t.file.size;
  }

  if (totalBytes > maxTotalBytes) {
    throw Object.assign(new Error("Total files size exceeds ZIP safety limit"), { code: "ZIP_TOO_LARGE" });
  }

  // 2. 提取每个任务的 Uint8Array
  const entries: ZipEntry[] = [];
  for (const task of completedTasks) {
    const ext = task.result?.extension || "png";
    const filename = sanitizeFilename(task.originalName, ext);

    const blob = task.resultBlob || task.file;
    const arrayBuffer = await blob.arrayBuffer();
    entries.push({
      name: filename,
      data: new Uint8Array(arrayBuffer),
    });
  }

  // 3. 打包生成 ZIP
  const zipBuffer = await packZip(entries);

  // 4. 触发下载
  const zipBlob = new Blob([zipBuffer.buffer as ArrayBuffer], {
    type: "application/zip",
  });
  downloadBlob(zipBlob, zipFilename);
}
