import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeFilename, deduplicateFilenames } from "../../lib/image/policy";
import { useCompressionQueue } from "../../composables/useCompressionQueue.client";

describe("T03-03 · Security, Privacy & CSP Audit", () => {
  describe("1. Cloudflare Pages _headers & CSP Configuration", () => {
    const headersPath = path.resolve(__dirname, "../../public/_headers");

    it("should provide public/_headers with production security headers", () => {
      expect(fs.existsSync(headersPath)).toBe(true);
      const content = fs.readFileSync(headersPath, "utf8");

      // 验证关键防御响应头
      expect(content).toContain("X-Content-Type-Options: nosniff");
      expect(content).toContain("X-Frame-Options: DENY");
      expect(content).toContain("Referrer-Policy: strict-origin-when-cross-origin");
      expect(content).toContain("Strict-Transport-Security: max-age=31536000");
      expect(content).toContain("Permissions-Policy:");
      expect(content).toContain("camera=()");
      expect(content).toContain("microphone=()");
      expect(content).toContain("geolocation=()");
    });

    it("should enforce strict Content-Security-Policy with zero unauthorized egress", () => {
      const content = fs.readFileSync(headersPath, "utf8");

      // 提取 CSP 规则
      const cspMatch = content.match(/Content-Security-Policy:\s*(.+)/);
      expect(cspMatch).not.toBeNull();
      const csp = cspMatch![1];

      // 验证 CSP 白名单限制
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("img-src 'self' blob: data:");
      expect(csp).toContain("object-src 'none'");
      // connect-src 必须仅允许 self，严禁连接外部不可控 API
      expect(csp).toContain("connect-src 'self'");
    });

    it("should configure proper cache-control headers for static and wasm assets", () => {
      const content = fs.readFileSync(headersPath, "utf8");
      expect(content).toContain("/_nuxt/*");
      expect(content).toContain("Cache-Control: public, max-age=31536000, immutable");
      expect(content).toContain("*.wasm");
      expect(content).toContain("Content-Type: application/wasm");
    });
  });

  describe("2. Path Traversal & Filename Sanitization Defense", () => {
    it("should eliminate path traversal sequences (../../, ..\\)", () => {
      expect(sanitizeFilename("../../../../etc/passwd", "webp")).toBe(
        "________etc_passwd.webp",
      );
      expect(
        sanitizeFilename("..\\..\\windows\\system32\\calc.exe", "png"),
      ).toBe("____windows_system32_calc.png");
    });

    it("should filter null bytes and invisible control characters", () => {
      const maliciousName = "innocent\x00image\x08file\x1b.jpg";
      const cleaned = sanitizeFilename(maliciousName, "png");
      expect(cleaned).not.toContain("\x00");
      expect(cleaned).not.toContain("\x08");
      expect(cleaned).not.toContain("\x1b");
      expect(cleaned).toBe("innocentimagefile.png");
    });

    it("should sanitize filesystem special and dangerous characters", () => {
      const dangerous = "file:name*with?quote\"pipe|and<tag>.jpeg";
      const cleaned = sanitizeFilename(dangerous, "webp");
      expect(cleaned).toBe("file_name_with_quote_pipe_and_tag_.webp");
    });

    it("should enforce the target format extension without trusting original extension", () => {
      expect(sanitizeFilename("exploit.php.jpg", "png")).toBe("exploit.php.png");
      expect(sanitizeFilename("shell.sh", "jpg")).toBe("shell.jpg");
    });

    it("should provide safe fallback when filename is empty or only special characters", () => {
      expect(sanitizeFilename("", "webp")).toBe("image.webp");
      expect(sanitizeFilename("   ", "png")).toBe("image.png");
      expect(sanitizeFilename("../..", "jpg")).toBe("image.jpg");
    });

    it("should deduplicate filenames safely and deterministically", () => {
      const names = ["photo.webp", "photo.webp", "photo.webp", "avatar.png"];
      const deduplicated = deduplicateFilenames(names);
      expect(deduplicated).toEqual([
        "photo.webp",
        "photo-2.webp",
        "photo-3.webp",
        "avatar.png",
      ]);
    });
  });

  describe("3. Zero-Egress Privacy & Network Isolation Audit", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.URL.createObjectURL = vi.fn((_blob: any) => "blob:mock-url");
      globalThis.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should verify that queue processing executes 100% in browser with ZERO external fetch requests", async () => {
      const fetchSpy = vi.fn().mockImplementation(() => {
        throw new Error("UNAUTHORIZED NETWORK ACCESS: Zero-egress privacy policy violated!");
      });
      globalThis.fetch = fetchSpy;

      // 构造模拟 Worker
      class MockWorker {
        listeners: Record<string, Function[]> = {};
        terminated = false;
        addEventListener(type: string, listener: Function) {
          if (!this.listeners[type]) this.listeners[type] = [];
          this.listeners[type].push(listener);
        }
        removeEventListener() {}
        postMessage(data: any) {
          if (data.type === "PROCESS") {
            setTimeout(() => {
              const res = {
                type: "SUCCESS",
                taskId: data.taskId,
                result: {
                  id: data.taskId,
                  originalName: data.inputName,
                  originalBytes: data.input.byteLength,
                  resultBytes: 50,
                  mime: "image/png",
                  extension: "png",
                  width: 1,
                  height: 1,
                  elapsedMs: 2,
                  mode: "lossless",
                  unchanged: false,
                  data: new ArrayBuffer(50),
                },
              };
              for (const l of this.listeners["message"] || []) {
                l({ data: res });
              }
            }, 10);
          }
        }
        terminate() {
          this.terminated = true;
        }
      }

      const { WorkerClient } = await import("../../lib/image/workerClient");
      const mockClient = new WorkerClient({
        workerFactory: () => new MockWorker() as unknown as Worker,
      });

      const queue = useCompressionQueue({
        workerClient: mockClient,
      });

      // 合法 1x1 静态 PNG
      const validPngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const dummyFile = new File([validPngBytes.buffer as ArrayBuffer], "private-passport.png", {
        type: "image/png",
      });

      await queue.addFiles([dummyFile]);

      // 等待队列消费完成
      await new Promise((resolve) => setTimeout(resolve, 80));

      // 验证任务处理成功
      expect(queue.tasks.value.length).toBe(1);
      expect(queue.tasks.value[0].status).toBe("success");
      expect(queue.tasks.value[0].result?.resultBytes).toBe(50);

      // 验证核心隐私断言：整个压缩流程绝不调用 fetch 或向外部服务器发送数据
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should statically verify codebase contains no telemetry or analytics sending image data", () => {
      const srcFiles = [
        "composables/useCompressionQueue.client.ts",
        "lib/image/codecs.ts",
        "lib/image/download.ts",
        "lib/image/policy.ts",
        "workers/image.worker.ts",
      ];

      for (const relativePath of srcFiles) {
        const fullPath = path.resolve(__dirname, "../../", relativePath);
        if (fs.existsSync(fullPath)) {
          const code = fs.readFileSync(fullPath, "utf8");
          // 确保代码中没有网络发送 API
          expect(code).not.toMatch(/navigator\.sendBeacon/);
          expect(code).not.toMatch(/XMLHttpRequest/);
          expect(code).not.toMatch(/postData/);
          expect(code).not.toMatch(/analytics\.track/);
        }
      }
    });
  });
});
